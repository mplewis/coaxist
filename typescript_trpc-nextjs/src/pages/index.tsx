import { type NextPage } from "next";

import { api } from "../utils/api";
import Layout from "../components/Layout";
import Post from "../components/Post";

const Home: NextPage = () => {
  const { data } = api.search.search.useQuery({ q: "Barbie" });

  return (
    <Layout>
      <div className="page">
        <h1>Hello World</h1>
        <main>
          <pre>
            <code>{JSON.stringify(data, null, 2)}</code>
          </pre>
        </main>
      </div>
    </Layout>
  );
};

export default Home;
