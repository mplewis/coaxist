import { type NextPage } from "next";

import { api } from "../utils/api";
import Layout from "../components/Layout";
import Link from "next/link";

const Home: NextPage = () => {
  const { data } = api.media.search.useQuery({ q: "Star Trek" });

  return (
    <Layout>
      <div className="page">
        <main>
          {data?.map((media) => (
            <div key={media.imdb_id}>
              <h2>
                <Link href={`/${media.type}/${media.imdb_id}`}>
                  {media.name} ({media.releaseInfo})
                </Link>
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
