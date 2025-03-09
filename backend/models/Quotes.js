import mongoose from "mongoose";

const quotesSchema = new mongoose.Schema({
  text: { type: String, required: true, unique: true },
  author: { type: String, default: 'anonymous' },
})

const Quotes = mongoose.model("Quotes", quotesSchema);
export default Quotes;
