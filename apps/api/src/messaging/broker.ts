export type RoomId = string;
export type Subscriber<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export interface Broker<T> {
  subscribe(room: RoomId, subscriber: Subscriber<T>): Unsubscribe;
  publish(room: RoomId, payload: T): Promise<void>;
  size(room: RoomId): number;
  close(): Promise<void>;
}

export class InProcessBroker<T> implements Broker<T> {
  private readonly rooms = new Map<RoomId, Set<Subscriber<T>>>();

  subscribe(room: RoomId, subscriber: Subscriber<T>): Unsubscribe {
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

  async publish(room: RoomId, payload: T) {
    const members = this.rooms.get(room);
    if (!members) return;

    for (const subscriber of [...members]) {
      try {
        subscriber(payload);
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
