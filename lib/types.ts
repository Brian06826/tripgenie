import { z } from 'zod'

// Schema for what Claude outputs (no URLs — added server-side)
export const ParkingSchema = z.object({
  available: z.boolean(),
  type: z.enum(['free', 'paid', 'street', 'valet', 'structure']),
  details: z.string(),
  tips: z.string().optional(),
})

export const BackupOptionSchema = z.object({
  name: z.string(),
  nameLocal: z.string().optional(),
  description: z.string(),
  googleRating: z.number().min(1).max(5).optional(),
  yelpRating: z.number().min(1).max(5).optional(),
  address: z.string(),
})

// Full backup option with URLs added server-side
export const BackupOptionFullSchema = BackupOptionSchema.extend({
  googleMapsUrl: z.string(),
  yelpUrl: z.string(),
})

export const PlaceGenerationSchema = z.object({
  name: z.string(),
  nameLocal: z.string().optional(),
  type: z.enum(['attraction', 'restaurant', 'hotel', 'transport', 'other']),
  description: z.string(),
  arrivalTime: z.string().optional(),
  duration: z.string().optional(),
  googleRating: z.number().min(1).max(5).optional(),
  googleReviewCount: z.number().optional(),
  yelpRating: z.number().min(1).max(5).optional(),
  yelpReviewCount: z.number().optional(),
  address: z.string(),
  parking: ParkingSchema,
  tips: z.string().optional(),
  priceRange: z.string().optional(),
  backupOptions: z.array(BackupOptionSchema).optional(),
})

export const DayPlanGenerationSchema = z.object({
  dayNumber: z.number(),
  title: z.string(),
  places: z.array(PlaceGenerationSchema),
})

export const TripGenerationSchema = z.object({
  title: z.string(),
  destination: z.string(),
  days: z.array(DayPlanGenerationSchema),
  language: z.enum(['en', 'zh-TW', 'zh-HK']),
})

// Full Place with URLs added server-side
export const PlaceSchema = PlaceGenerationSchema.extend({
  googleMapsUrl: z.string(),
  yelpUrl: z.string(),
  backupOptions: z.array(BackupOptionFullSchema).optional(),
})

// Full stored Trip
export const TripSchema = TripGenerationSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  ogImageUrl: z.string().optional(),
  days: z.array(
    DayPlanGenerationSchema.extend({
      places: z.array(PlaceSchema),
    })
  ),
})

export type Parking = z.infer<typeof ParkingSchema>
export type BackupOption = z.infer<typeof BackupOptionFullSchema>
export type Place = z.infer<typeof PlaceSchema>
export type DayPlan = z.infer<typeof TripSchema>['days'][number]
export type Trip = z.infer<typeof TripSchema>
export type TripGeneration = z.infer<typeof TripGenerationSchema>
