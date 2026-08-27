import type { Message } from '@lm/contracts';

export type RoomId = string;
export type Subscriber = (message: Message) => void;
export type Unsubscribe = () => void;

export interface Broker {
  subscribe(room: RoomId, subscriber: Subscriber): Unsubscribe;
  publish(room: RoomId, message: Message): Promise<void>;
  size(room: RoomId): number;
  close(): Promise<void>;
}

export class InProcessBroker implements Broker {
  private readonly rooms = new Map<RoomId, Set<Subscriber>>();

  subscribe(room: RoomId, subscriber: Subscriber): Unsubscribe {
    let members = this.rooms.get(room);
    if (!members) {
      members = new Set();
      this.rooms.set(room, members);
    }
    members.add(subscriber);

    return () => {
      const current = this.rooms.get(room);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) this.rooms.delete(room);
    };
  }

  async publish(room: RoomId, message: Message) {
    const members = this.rooms.get(room);
    if (!members) return;

    for (const subscriber of [...members]) {
      try {
        subscriber(message);
      } catch {
        members.delete(subscriber);
      }
    }
  }

  size(room: RoomId) {
    return this.rooms.get(room)?.size ?? 0;
  }

  async close() {
    this.rooms.clear();
  }
}
