import {
  ClientFrame,
  CloseCode,
  HEARTBEAT_MS,
  MAX_BODY_CHARS,
  MAX_BUFFERED_BYTES,
  MAX_REPLAY,
  PROTOCOL_VERSION,
  type Message,
  type ServerFrame,
  type WsErrorCode
} from '@lm/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { auth } from '../auth';
import { toHeaders } from '../routes/auth-routes';
import type { Broker } from './broker';
import {
  appendMessage,
  currentSeq,
  historySince,
  resolveParticipant,
  type Participant
} from './service';
import { readTicket } from './ticket';

const SEND_WINDOW_MS = 10_000;
const SEND_LIMIT_PER_WINDOW = 30;

type Query = { after?: string; ticket?: string };
type Params = { id: string };

declare module 'fastify' {
  interface FastifyRequest {
    participant?: Participant;
  }
}

export function registerMessageSocket(app: FastifyInstance, broker: Broker<Message>) {
  const open = new Set<WebSocket>();
  const writing = new Set<Promise<void>>();

  app.addHook('onClose', async () => {
    for (const socket of open) {
      try {
        socket.close(CloseCode.serverShutdown, 'server shutting down');
        socket.terminate();
      } catch {
        socket.terminate();
      }
    }
    open.clear();
    await Promise.allSettled([...writing]);
    writing.clear();
  });

  app.get<{ Params: Params; Querystring: Query }>(
    '/ws/collaborations/:id',
    {
      websocket: true,
      preValidation: async (
        request: FastifyRequest<{ Params: Params; Querystring: Query }>,
        reply
      ) => {
        const identity = await identify(request);
        if (!identity) {
          return reply.code(401).send({ code: 'not_authenticated', message: 'Sign in to continue.' });
        }
        if (identity.collaborationId && identity.collaborationId !== request.params.id) {
          return reply
            .code(403)
            .send({ code: 'wrong_account_type', message: 'That ticket is for another conversation.' });
        }

        const participant = await resolveParticipant(
          request.params.id,
          identity.userId,
          identity.accountType
        );
        if (!participant) {
          return reply
            .code(404)
            .send({ code: 'not_found', message: 'No such conversation for this account.' });
        }

        request.participant = participant;
      }
    },
    (socket, request) => {
      const participant = request.participant;
      if (!participant) {
        socket.close(CloseCode.unauthenticated, 'no participant');
        return;
      }
      open.add(socket);
      socket.once('close', () => open.delete(socket));
      void openConnection(socket, participant, parseCursor(request.query.after), broker, writing);
    }
  );
}

async function identify(request: FastifyRequest<{ Params: Params; Querystring: Query }>) {
  const raw = request.query.ticket;
  if (raw) {
    const ticket = readTicket(raw);
    return ticket
      ? {
          userId: ticket.userId,
          accountType: ticket.accountType,
          collaborationId: ticket.collaborationId
        }
      : null;
  }

  const result = await auth.api.getSession({ headers: toHeaders(request.headers) });
  if (!result?.user) return null;

  const accountType = (result.user as { accountType?: 'brand' | 'creator' }).accountType;
  if (accountType !== 'brand' && accountType !== 'creator') return null;

  return { userId: result.user.id, accountType, collaborationId: null };
}

function parseCursor(raw: string | undefined) {
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

async function openConnection(
  socket: WebSocket,
  participant: Participant,
  cursor: number,
  broker: Broker<Message>,
  writing: Set<Promise<void>>
) {
  const room = participant.collaborationId;

  let phase: 'loading' | 'live' | 'closed' = 'loading';
  let lastSentSeq = cursor;
  let pending: Message[] = [];
  let awaitingPong = false;
  let sendTimes: number[] = [];
  let sendChain: Promise<void> = Promise.resolve();

  const send = (frame: ServerFrame) => {
    if (socket.readyState !== socket.OPEN) return;
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      socket.close(CloseCode.backpressure, 'client too slow');
      return;
    }
    socket.send(JSON.stringify(frame));
  };

  const fail = (code: WsErrorCode, message: string, id?: string) =>
    send({ t: 'error', code, message, ...(id ? { id } : {}) });

  const emit = (message: Message) => {
    if (message.seq <= lastSentSeq) return;
    lastSentSeq = message.seq;
    send({ t: 'message', message });
  };

  const unsubscribe = broker.subscribe(room, (message) => {
    if (phase === 'closed') return;
    if (phase === 'loading') {
      pending.push(message);
      return;
    }
    emit(message);
  });

  const cleanup = () => {
    phase = 'closed';
    clearInterval(heartbeat);
    unsubscribe();
    pending = [];
  };

  const heartbeat = setInterval(() => {
    if (socket.readyState !== socket.OPEN) return;
    if (awaitingPong) {
      socket.close(CloseCode.timeout, 'no pong');
      return;
    }
    awaitingPong = true;
    socket.ping();
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('pong', () => {
    awaitingPong = false;
  });

  try {
    const [history, lastSeq] = await Promise.all([
      historySince(room, cursor, MAX_REPLAY),
      currentSeq(room)
    ]);

    send({
      t: 'ready',
      version: PROTOCOL_VERSION,
      collaborationId: room,
      you: participant.actor,
      lastSeq,
      replayed: history.items.length,
      truncated: history.truncated
    });

    for (const message of history.items) emit(message);

    const buffered = pending.sort((a, b) => a.seq - b.seq);
    pending = [];
    phase = 'live';
    for (const message of buffered) emit(message);
  } catch {
    cleanup();
    socket.close(CloseCode.serverShutdown, 'could not load history');
    return;
  }

  const enqueueSend = (id: string, body: string) => {
    sendChain = sendChain.then(() => deliver(id, body));
    const tail = sendChain;
    writing.add(tail);
    void tail.finally(() => writing.delete(tail));
  };

  const deliver = async (id: string, body: string) => {
    try {
      const { message, created } = await appendMessage({ id, participant, body });
      send({ t: 'ack', id: message.id, seq: message.seq });
      if (!created) return;
      emit(message);
      await broker.publish(room, message);
    } catch {
      fail('send_failed', 'That message was not saved. Try again.', id);
    }
  };

  socket.on('message', (raw) => {
    awaitingPong = false;

    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      fail('bad_frame', 'Frames must be JSON.');
      return;
    }

    const frame = ClientFrame.safeParse(parsed);
    if (!frame.success) {
      const body = (parsed as { body?: unknown })?.body;
      const tooLong = typeof body === 'string' && body.length > MAX_BODY_CHARS;
      fail(
        tooLong ? 'body_too_long' : 'bad_frame',
        tooLong ? `Messages are capped at ${MAX_BODY_CHARS} characters.` : 'Unrecognised frame.',
        (parsed as { id?: string })?.id
      );
      return;
    }

    if (frame.data.t === 'ping') {
      send({ t: 'pong' });
      return;
    }

    const now = Date.now();
    sendTimes = sendTimes.filter((at) => now - at < SEND_WINDOW_MS);
    if (sendTimes.length >= SEND_LIMIT_PER_WINDOW) {
      fail('rate_limited', 'Slow down.', frame.data.id);
      return;
    }
    sendTimes.push(now);

    enqueueSend(frame.data.id, frame.data.body);
  });
}
