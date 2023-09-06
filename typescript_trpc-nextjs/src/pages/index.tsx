import { type NextPage } from "next";

import { api } from "../utils/api";
import Layout from "../components/Layout";

const Home: NextPage = () => {
  const { data } = api.media.search.useQuery({ q: "Star Trek" });

  return (
    <Layout>
      <div className="page">
        <h1>Hello World</h1>
        <main>
          {data?.map((media) => (
            <div key={media.imdb_id}>
              <h2>
                {media.name} ({media.releaseInfo})
              </h2>
              <p>{media.type}</p>
              <img src={media.poster} alt={media.name} />
            </div>
          ))}
        </main>
      </div>
    </Layout>
  );
};

export default Home;
