import type { CollabChanged } from '@lm/contracts';
import type { Broker } from '../messaging/broker';

export type StatusBus = Broker<CollabChanged>;

export const brandRoom = (brandId: string) => `brand:${brandId}`;
export const creatorRoom = (creatorId: string) => `creator:${creatorId}`;
