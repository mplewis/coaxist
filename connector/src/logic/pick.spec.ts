import { describe, expect, it } from "vitest";
import { Profile } from "./profile";
import { TorrentInfo } from "./parse";
import { Quality, Tag } from "./classify";
import { pickBest } from "./pick";

function cand(seeders: number, quality: Quality, tags: Tag[]): TorrentInfo {
  return {
    seeders,
    quality,
    tags,
    url: "url",
    bytes: 0,
    tracker: "tracker",
  };
}

describe("pickBest", () => {
  it("picks the best candidate", () => {
    const profile: Profile = {
      name: "Most Compatible",
      maximum: { quality: "1080p" },
      required: ["multiaudio"],
      discouraged: ["hdr"],
      forbidden: ["hdtv"],
    };
    const cands = [
      cand(333, "2160p", []),
      cand(105, "1080p", ["hdr"]),
      cand(105, "1080p", []),
      cand(105, "1080p", ["hdtv", "multiaudio"]),
      cand(100, "1080p", ["multiaudio"]), // pick!
      cand(97, "1080p", []),
      cand(333, "720p", []),
    ];
    expect(pickBest(profile, cands)).toEqual(cands[4]);
  });

  it("downranks candidates that match discouraged criteria", () => {
    const profile: Profile = {
      name: "No HDR",
      discouraged: ["hdr"],
    };
    const cands = [
      cand(100, "2160p", ["hdr"]),
      cand(5, "480p", []), // pick!
    ];
    expect(pickBest(profile, cands)).toEqual(cands[1]);
  });

  it("ignores candidates missing the required criteria", () => {
    const profile: Profile = {
      name: "HDR required",
      required: ["hdr"],
    };
    const cands = [
      cand(100, "2160p", []),
      cand(100, "1080p", []),
      cand(100, "480p", []),
    ];
    expect(pickBest(profile, cands)).toEqual(null);
  });

  it("returns no candidate if none are acceptable", () => {
    const profile: Profile = {
      name: "1080p",
      minimum: { quality: "1080p" },
      maximum: { quality: "1080p" },
      forbidden: ["hdr"],
    };
    const cands = [
      cand(100, "2160p", []),
      cand(100, "1080p", ["hdr"]),
      cand(100, "720p", []),
    ];
    expect(pickBest(profile, cands)).toEqual(null);
  });
});
