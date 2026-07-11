import { useState, useCallback } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  agentId: string;
  size?: number;
  averageRating?: number;
  totalReviews?: number;
}

// Hardcoded average ratings per agent (for demo)
const AGENT_RATINGS: Record<string, { avg: number; reviews: number }> = {
  "hotel-booker": { avg: 4.8, reviews: 342 },
  "flight-booker": { avg: 4.6, reviews: 218 },
  "finance-ledger": { avg: 4.9, reviews: 156 },
  "mom-scheduler": { avg: 4.7, reviews: 89 },
  "grocery-runner": { avg: 4.5, reviews: 127 },
  "inbox-triage": { avg: 4.4, reviews: 203 },
  "travel-concierge": { avg: 4.8, reviews: 95 },
};

// Load ratings from localStorage
function getRating(agentId: string): number {
  try {
    const ratings = JSON.parse(localStorage.getItem("astor-ratings") ?? "{}");
    return ratings[agentId] ?? 0;
  } catch {
    return 0;
  }
}

// Save rating to localStorage
function saveRating(agentId: string, rating: number) {
  try {
    const ratings = JSON.parse(localStorage.getItem("astor-ratings") ?? "{}");
    ratings[agentId] = rating;
    localStorage.setItem("astor-ratings", JSON.stringify(ratings));
  } catch {
    // Ignore storage errors
  }
}

export function StarRating({ agentId, size = 12 }: StarRatingProps) {
  const [rating, setRating] = useState(() => getRating(agentId));
  const [hoveredStar, setHoveredStar] = useState(0);

  const agentRating = AGENT_RATINGS[agentId] ?? { avg: 4.5, reviews: 100 };

  const handleRate = useCallback((star: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    const newRating = star === rating ? 0 : star; // Toggle off if clicking same star
    setRating(newRating);
    saveRating(agentId, newRating);
  }, [agentId, rating]);

  const displayRating = hoveredStar || rating;

  return (
    <div
      className="flex flex-col items-end gap-1"
      onMouseLeave={() => setHoveredStar(0)}
      onClick={(e) => e.stopPropagation()} // Prevent card click
    >
      {/* Stars row */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHoveredStar(star)}
            onClick={(e) => handleRate(star, e)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRate(star, e as unknown as React.MouseEvent); }}
            className="cursor-pointer transition-transform duration-150 hover:scale-110"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              size={size}
              strokeWidth={1.5}
              className={`transition-colors duration-150 ${
                star <= displayRating
                  ? "fill-brass text-brass"
                  : "fill-transparent text-bone-faint/30 hover:text-bone-faint/50"
              }`}
            />
          </span>
        ))}
      </div>

      {/* Average rating */}
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] text-brass/80">
          {agentRating.avg.toFixed(1)}
        </span>
        <span className="font-mono text-[9px] text-bone-faint/40">
          ({agentRating.reviews})
        </span>
      </div>
    </div>
  );
}
