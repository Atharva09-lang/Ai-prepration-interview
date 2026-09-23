import mongoose from 'mongoose';
import {
  REQUIREMENT_KINDS,
  REQUIREMENT_PRIORITIES,
  QUESTION_CATEGORIES,
} from '../validators/kit.schema.js';

const { Schema } = mongoose;


export const ORIGINS = ['generated', 'edited', 'user'];
const builderState = () => ({
  origin: { type: String, enum: ORIGINS, default: 'generated' },
  pinned: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false }, // tombstone so regeneration cannot resurrect it
  order: { type: Number, default: 0 },
});

const requirementSchema = new Schema(
  {
    id: { type: String, required: true },
    text: String,
    kind: { type: String, enum: REQUIREMENT_KINDS },
    priority: { type: String, enum: REQUIREMENT_PRIORITIES },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    requirement_ids: [String],
    category: { type: String, enum: QUESTION_CATEGORIES },
    prompt: String,
    answer_outline: String,
    difficulty: Number,
    ...builderState(),
  },
  { _id: false },
);

const flashcardSchema = new Schema(
  {
    id: { type: String, required: true },
    front: String,
    back: String,
    requirement_ids: [String],
    ...builderState(),
  },
  { _id: false },
);

const scheduleDaySchema = new Schema(
  { day: Number, focus: String, question_ids: [String], minutes: Number },
  { _id: false },
);

const hiringProcessSchema = new Schema(
  { found: Boolean, summary: String, stages: [String] },
  { _id: false },
);

const practiceEntrySchema = new Schema(
  { confidence: Number, seen_count: Number, last_reviewed_at: Date },
  { _id: false },
);

const kitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dedupeKey: { type: String, required: true },
    input: { jd: String, company_url: String, days: Number },
    status: { type: String, enum: ['generating', 'ready', 'failed'], default: 'generating' },

    source: {
      company: String,
      company_url: String,
      role: String,
      location: String,
      jd_chars: Number,
      researched_at: String,
      pages_used: [String],
    },
    company_brief: {
      summary: String,
      what_they_do: String,
      sources: [String],
      origin: { type: String, enum: ORIGINS, default: 'generated' },
      pinned: { type: Boolean, default: false },
    },
    role: {
      title: String,
      seniority: String,
      responsibilities: [String],
      requirements: [requirementSchema],
    },
    questions: [questionSchema],
    flashcards: [flashcardSchema],
    schedule: { days_available: Number, days: [scheduleDaySchema] },
    coverage: { uncovered_requirement_ids: [String], passes: Number },
    research: {
      pages_failed: [{ _id: false, url: String, reason: String }],
      hiring_page_found: Boolean,
      discussion_found: Boolean,
      discussion_sources: [String],
      hiring_process: { type: hiringProcessSchema, default: null },
    },
    warnings: [String],


    counters: {
      r: { type: Number, default: 0 },
      q: { type: Number, default: 0 },
      f: { type: Number, default: 0 },
    },
    practice: { type: Map, of: practiceEntrySchema, default: {} },
    // Day numbers the user has ticked off in the study schedule. Stored on the
    // kit (not in the browser) so progress survives a new device or browser.
    completed_days: { type: [Number], default: [] },
  },
  { timestamps: true },
);


kitSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
kitSchema.index({ userId: 1, updatedAt: -1 });

kitSchema.set('toJSON', {
  flattenMaps: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.userId;
    delete ret.dedupeKey;
    return ret;
  },
});

export const Kit = mongoose.model('Kit', kitSchema);