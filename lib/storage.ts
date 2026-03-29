import { Trip as TripItinerary } from './types';

const isProduction = !!process.env.REDIS_URL;

let redisClient: any = null;

async function getRedis() {
  if (!redisClient) {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    });
    await redisClient.connect();
  }
  return redisClient;
}

async function redisGet(id: string): Promise<TripItinerary | null> {
  try {
    const redis = await getRedis();
    const data = await redis.get(`trip:${id}`);
    if (!data) return null;
    return JSON.parse(data) as TripItinerary;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
}

async function redisSet(id: string, trip: TripItinerary): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.set(`trip:${id}`, JSON.stringify(trip), 'EX', 7776000); // 90 days
  } catch (error) {
    console.error('Redis SET error:', error);
    throw error;
  }
}

async function fileGet(id: string): Promise<TripItinerary | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dir = path.join(process.cwd(), '.next', 'dev-trips');
    const filePath = path.join(dir, `${id}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as TripItinerary;
  } catch {
    return null;
  }
}

async function fileSet(id: string, trip: TripItinerary): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.join(process.cwd(), '.next', 'dev-trips');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(trip, null, 2));
}

export async function saveTrip(id: string, trip: TripItinerary): Promise<void> {
  if (isProduction) {
    await redisSet(id, trip);
  } else {
    await fileSet(id, trip);
  }
}

export async function getTrip(id: string): Promise<TripItinerary | null> {
  if (isProduction) {
    return redisGet(id);
  } else {
    return fileGet(id);
  }
}
