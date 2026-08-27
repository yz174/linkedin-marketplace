import type { Actor, CollabChanged, CollabState } from '@lm/contracts';
import type { Broker } from '../messaging/broker';

export type StatusBus = Broker<CollabChanged>;

export const brandRoom = (brandId: string) => `brand:${brandId}`;
export const creatorRoom = (creatorId: string) => `creator:${creatorId}`;

export type ChangedRow = {
  id: string;
  reference: string;
  creatorId: string;
  feeMinor: number;
  counterFeeMinor: number | null;
  updatedAt: Date;
};

export async function publishCollabChange(
  bus: StatusBus,
  input: {
    row: ChangedRow;
    brandId: string;
    from: CollabState;
    to: CollabState;
    actor: Actor;
  }
) {
  const frame: CollabChanged = {
    t: 'collab_changed',
    collaborationId: input.row.id,
    reference: input.row.reference,
    from: input.from,
    to: input.to,
    actor: input.actor,
    feeMinor: input.row.feeMinor,
    counterFeeMinor: input.row.counterFeeMinor,
    updatedAt: input.row.updatedAt.toISOString()
  };

  await bus.publish(brandRoom(input.brandId), frame);
  await bus.publish(creatorRoom(input.row.creatorId), frame);
}
