import { useRouter } from "next/router";
import { api } from "../utils/api";
import { TorrentioStream } from "../server/api/routers/media";

export type TorrentDataProps =
  | {
      type: "movie";
      imdbID: string;
    }
  | {
      type: "series";
      imdbID: string;
      season: number;
      episode: number;
    };

export const TorrentData = (props: TorrentDataProps) => {
  const { data } =
    props.type === "movie"
      ? api.media.torrent.movie.useQuery(props)
      : api.media.torrent.series.useQuery(props);

  if (!data) return <p>Loading torrents...</p>;

  function tags(stream: TorrentioStream): string {
    return (stream.behaviorHints.bingeGroup || "").split("|").join(", ");
  }

  return (
    <ul>
      {data.map((stream) => (
        <li>
          <p>
            <a href={stream.url}>{stream.title}</a>
          </p>
          <p>{tags(stream)}</p>
        </li>
      ))}
    </ul>
  );
};
