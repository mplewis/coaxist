import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { api } from "../../utils/api";
import { TorrentData } from "../../components/TorrentData";

const Media = () => {
  const id = useRouter().query.id;
  if (!id) {
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
  }
  const { data } = api.media.meta.movie.useQuery({ imdbID: id.toString() });

  if (!data) {
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
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
          <TorrentData type="movie" imdbID={data.imdb_id} />
        </main>
      </div>
    </Layout>
  );
};

export default Media;
