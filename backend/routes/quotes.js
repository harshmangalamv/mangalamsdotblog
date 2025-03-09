import express, { Router } from 'express';
import Quotes from '../models/Quotes.js';
import { verifySuperUser } from '../middleware/verifySuperUser.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try{
    const quotes = Quotes.find();
    res.json(quotes);
  }
  catch(err){
    res.status(500).json({ message: "Server error" });
  }
})

// Protected: Add a quote (Only for Superuser)
router.post("/", verifySuperUser, async (req, res) => {
  try {
    const { text, author } = req.body;
    const newQuote = new Quote({ text, author });
    await newQuote.save();
    res.status(201).json(newQuote);
  } catch (error) {
    res.status(400).json({ message: "Error saving quote" });
  }
});

// Protected: Update a quote
router.put("/:id", verifySuperUser, async (req, res) => {
  try {
    const { text, author } = req.body;
    const updatedQuote = await Quote.findByIdAndUpdate(
      req.params.id,
      { text, author },
      { new: true }
    );
    res.json(updatedQuote);
  } catch (error) {
    res.status(400).json({ message: "Error updating quote" });
  }
});

// Protected: Delete a quote
router.delete("/:id", verifySuperUser, async (req, res) => {
  try {
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ message: "Quote deleted" });
  } catch (error) {
    res.status(400).json({ message: "Error deleting quote" });
  }
});

export default router;