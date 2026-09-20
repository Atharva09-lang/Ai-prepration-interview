import mongoose from 'mongoose';

const { Schema } = mongoose;

const progressSchema = new Schema(
  {
    stage: String,
    status: { type: String, enum: ['running', 'done', 'failed'] },
    detail: { type: String, default: '' },
    at: Date,
  },
  { _id: false },
);

const errorSchema = new Schema({ code: String, message: String }, { _id: false });

const jobSchema = new Schema(
  {
    kitId: { type: Schema.Types.ObjectId, ref: 'Kit', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['generate', 'regenerate'], default: 'generate' },
    status: { type: String, enum: ['queued', 'running', 'succeeded', 'failed'], default: 'queued' },
    stage: { type: String, default: null },
    progress: [progressSchema],
    error: { type: errorSchema, default: null },
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);

export const Job = mongoose.model('Job', jobSchema);