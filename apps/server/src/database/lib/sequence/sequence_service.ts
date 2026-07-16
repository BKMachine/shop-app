import Sequence from './sequence_model.js';

async function nextValue(key: string): Promise<number> {
  const sequence = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    },
  ).lean();

  if (!sequence) throw new Error(`Unable to increment sequence: ${key}`);
  return Number(sequence.value) || 0;
}

export default {
  nextValue,
};
