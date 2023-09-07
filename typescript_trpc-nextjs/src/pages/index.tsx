import { type NextPage } from "next";

import { api } from "../utils/api";
import Layout from "../components/Layout";
import Link from "next/link";
import { useState } from "react";

const Home: NextPage = () => {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<string | null>(null);
  const { data } = api.media.search.useQuery({ q: search });

  const loading = Boolean(search && !data);

  let results: React.JSX.Element[] = [];
  if (loading) {
    results = [<p key="loading">Loading...</p>];
  } else if (data) {
    results = data.map((media) => (
      <div key={media.imdb_id}>
        <h2>
          <Link href={`/${media.type}/${media.imdb_id}`}>
            {media.name} ({media.releaseInfo})
          </Link>
        </h2>
        <p>{media.type}</p>
        <img src={media.poster} alt={media.name} />
      </div>
    ));
  }

  return (
    <Layout>
      <div className="page">
        <main>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query);
            }}>
            <label htmlFor="query" style={{ display: "block" }}>
              Search for a movie or TV show
            </label>
            <input
              style={{ display: "block" }}
              type="text"
              id="query"
              value={query}
              placeholder="Neon Genesis Evangelion"
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              style={{ display: "block" }}
              type="submit"
              disabled={loading}>
              Search
            </button>
          </form>
          <div>{results}</div>
        </main>
      </div>
    </Layout>
  );
};

export default Home;
