"use client";
import { FairmontStory } from "@/components/story/FairmontStory";

// The 10-second Fairmont story, to open the meeting. Full screen, no app shell.
export default function StoryPage() {
  return (
    <div className="story-page">
      <div className="story-copy">
        <p className="story-k">Silwan Field Ops</p>
        <h1>Know your technician was really there.</h1>
        <p className="muted">Check-in and check-out only work inside the site. If he leaves late or early, you know.</p>
      </div>
      <div className="story-stage">
        <FairmontStory />
      </div>
    </div>
  );
}
