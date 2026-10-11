import { z } from 'zod';
import { DOMAINS } from '../../shared/types';

const seed = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  domain: z.enum(DOMAINS),
});

export const sessionRequestSchema = z.object({
  nickname: z.string().trim().min(1).max(30),
  city: z.string().trim().max(60).optional(),
  bornDecade: z.number().int().min(1900).max(2000).optional(),
  seeds: z.array(seed).min(3).max(6),
  feedback: z
    .object({
      loved: z.array(seed).max(40),
      upsetIds: z.array(z.string().max(80)).max(120),
    })
    .optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(60),
  domain: z.enum(DOMAINS).optional(),
});
