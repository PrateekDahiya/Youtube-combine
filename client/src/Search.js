import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import Card from "./Card";
import axios from "axios";
import "./Search.css";
import CardGrid from "./CardGrid";

const defaultAvatar = "https://cdn-icons-png.flaticon.com/128/1077/1077063.png";

const Search = () => {
    const locationHook = useLocation();
    const [data, setData] = useState("");
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [page, setPage] = useState(locationHook.pathname);

    useEffect(() => {
        const fetchData = async () => {
            await axios
                .get(`${serverurl}/search` + window.location.search)
                .then((response) => {
                    setData(response.data);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchData();
    }, [page]);

    useEffect(() => {
        const currentpage = locationHook.pathname;
        setPage(currentpage);
    }, [locationHook]);
    return (
        <div className="searchPage">
            <p className="channel-find-error ">
                *If you can't find the channel, please send feedback with the
                channel ID to add it instantly.
            </p>
            {data.channels && data.channels.length > 0 ? (
                <div className="search-section">
                    <h2 className="search-heading">Channels</h2>
                    <div className="channel-results">
                        {data.channels.map((item) => (
                            <Link
                                key={item.channel_id}
                                to={`/channel?channel_id=${item.channel_id}`}
                                className="channel-result"
                            >
                                <img
                                    src={item.channel_icon || defaultAvatar}
                                    alt={item.channel_name || "channel"}
                                />
                                <div className="channel-result-text">
                                    <p className="channel-result-name">
                                        {item.channel_name || ""}
                                    </p>
                                    <p className="channel-result-meta">
                                        {item.custom_url || ""}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ) : null}
            {data.videos && data.videos.length > 0 ? (
                <div className="search-section">
                    <h2 className="search-heading">Videos</h2>
                    <CardGrid variant="fluid" className="search-cards">
                        {data.videos.map((item) => (
                            <Card key={item.video_id} data={item} />
                        ))}
                    </CardGrid>
                </div>
            ) : null}
        </div>
    );
};

export default Search;
