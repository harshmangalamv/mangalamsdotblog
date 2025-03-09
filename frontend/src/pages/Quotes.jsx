import { useEffect, useState } from "react";
import API from "../api";

const Quotes = () => {
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    const fetchQuotes = async () => {
      const res = await API.get("/quotes");
      setQuotes(res);
    };

    fetchQuotes();
  }, []);

  return (
    <div className="blogs-container blog-content">
      {quotes.length === 0 ? (
        <p>No quotes yet. Add one!</p>
      ) : (
        quotes.map((quote) => {
          <p>{quote}</p>;
        })
      )}
    </div>
  );
};

export default Quotes;
