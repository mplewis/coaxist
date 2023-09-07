import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { api } from "../../utils/api";
import { TorrentData } from "../../components/TorrentData";
import { useState } from "react";

const Media = (props: { id: string }) => {
  const { id } = props;
  const [lastLibraryUpdate, setLastLibraryUpdate] = useState(new Date());
  const [libraryUpdating, setLibraryUpdating] = useState(false);
  const { data: meta } = api.media.meta.movie.useQuery(
    { imdbID: id },
    { queryKeyHashFn: (key) => `${key}_${lastLibraryUpdate}` }
  );
  const { data: entry, isLoading: isLoadingEntry } = api.library.get.useQuery(
    { imdbID: id },
    { queryKeyHashFn: (key) => `${key}_${lastLibraryUpdate}` }
  );
  const add = api.library.add.useMutation();
  const remove = api.library.remove.useMutation();

  if (!meta || isLoadingEntry) {
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
  }

  let button = (
    <button
      disabled={libraryUpdating}
      onClick={async () => {
        setLibraryUpdating(true);
        try {
          await add.mutateAsync({ type: "movie", imdbID: meta.imdb_id });
        } catch (e) {
          // don't worry about it, just refresh
        }
        setLibraryUpdating(false);
        setLastLibraryUpdate(new Date());
      }}>
      Add to Library
    </button>
  );
  if (entry) {
    button = (
      <button
        disabled={libraryUpdating}
        onClick={async () => {
          setLibraryUpdating(true);
          try {
            await remove.mutateAsync({ imdbID: meta.imdb_id });
          } catch (e) {
            // don't worry about it, just refresh
          }
          setLibraryUpdating(false);
          setLastLibraryUpdate(new Date());
        }}>
        Remove from Library
      </button>
    );
  }

  return (
    <Layout>
      <div className="page">
        <h1>Media</h1>
        <main>
          <img src={meta.poster} alt={meta.name} />
          <h1>{meta.name}</h1>
          <p>
            {meta.year}, {meta.runtime}, {meta.genres.join(", ")}
          </p>
          <p>{meta.description}</p>
          {button}
          <TorrentData type="movie" imdbID={meta.imdb_id} />
        </main>
      </div>
    </Layout>
  );
};

const MediaWrapper = () => {
  const { id } = useRouter().query;
  if (!id)
    return (
      <p>
        <em>Loading...</em>
      </p>
    );
  return <Media id={id.toString()} />;
};

export default MediaWrapper;
