import Link from "next/link";
import { api } from "../utils/api";

export const Library = () => {
  const { data } = api.library.list.useQuery();
  return (
    <div>
      <h1>Library</h1>
      {data?.map((media) => (
        <p>
          <Link href={`/${media.type}/${media.imdbID}`}>
            {media.type}: {media.imdbID}
          </Link>
        </p>
      ))}
    </div>
  );
};

export default Library;
