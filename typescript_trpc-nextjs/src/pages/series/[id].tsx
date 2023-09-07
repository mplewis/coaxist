import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { api } from "../../utils/api";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { CinemetaEpisode } from "../../server/api/routers/search";
import { TorrentData } from "../../components/TorrentData";
dayjs.extend(relativeTime);

const Media = () => {
  const id = useRouter().query.id;
  if (!id) {
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
  }
  const { data } = api.media.meta.series.useQuery({ imdbID: id.toString() });

  if (!data) {
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
  }

  function releaseText(video: CinemetaEpisode): string {
    const releaseDate = new Date(video.released);
    let releaseText = releaseDate.toString();
    if (releaseDate > new Date()) {
      releaseText = `${releaseDate} (${dayjs(releaseDate).fromNow()})`;
    }
    return releaseText;
  }

  return (
    <Layout>
      <div className="page">
        <h1>Media</h1>
        <main>
          <img src={data.poster} alt={data.name} />
          <h1>{data.name}</h1>
          <p>
            {data.year}, {data.runtime}, {data.genre.join(", ")}
          </p>
          <p>{data.description}</p>
          <ul>
            {data.videos.map((video) => (
              <li key={video.id}>
                <h2>{video.name}</h2>
                <img src={video.thumbnail} alt={video.name} />
                <p>{video.description}</p>
                <p>{releaseText(video)}</p>
                <TorrentData
                  type="series"
                  imdbID={data.imdb_id}
                  season={video.season}
                  episode={video.episode}
                />
              </li>
            ))}
          </ul>
        </main>
      </div>
    </Layout>
  );
};

export default Media;
