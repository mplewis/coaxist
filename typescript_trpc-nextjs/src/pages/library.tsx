import { api } from "../utils/api";

export const Library = () => {
  const { data } = api.library.list.useQuery();
  return (
    <div>
      <h1>Library</h1>
      {data?.map((media) => (
        <p>
          {media.type}: {media.imdbID}
        </p>
      ))}
    </div>
  );
};

export default Library;
