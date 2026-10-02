export default function DataNotice({error, retry}: {error: string; retry: () => void}) {
  if (!error) return null;
  return <div className="notice danger" role="alert">Live data is unavailable. {error.replaceAll("_", " ")}. <button className="secondary" type="button" onClick={retry}>Retry data</button></div>;
}
