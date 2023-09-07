import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { api } from "../../utils/api";

const Media = () => {
  const id = useRouter().query.id;
  if (!id) {
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
  }
  const { data } = api.media.series.useQuery({ imdbID: id.toString() });

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
          <ul>
            {data.videos.map((video) => (
              <li key={video.id}>
                <h2>{video.name}</h2>
                <img src={video.thumbnail} alt={video.name} />
                <p>{video.description}</p>
                <p>{video.released}</p>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </Layout>
  );
};

export default Media;
