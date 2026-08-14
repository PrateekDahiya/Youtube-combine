import { useEffect, useState } from "react";
import Card from "./Card";
import { likeApi } from "./api";
import "./Likedvideos.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";

const Likedvideos = (params) => {
    const [data, setData] = useState("");
    const [loading, setLoading] = useState(true);
    const [user_chl_id, setUser_chl_id] = useState(null);
    const user = params.user;

    useEffect(() => {
        const fetchData = async () => {
            if (!user_chl_id) return;
            try {
                const response = await likeApi.getLikedVideos(user_chl_id);
                setData(response.data);
            } catch (error) {
                console.log("Error fetching liked videos:", error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user_chl_id]);

    useEffect(() => {
        setUser_chl_id(user.channel_id);
    }, [user]);

    return (
        <div className="likedvideos-outerbox">
            <h1>Liked Videos</h1>
            {loading ? (
                <Cardloading page="likes" />
            ) : data.videos && params.active === "true" ? (
                <CardGrid variant="likes" className="likedvideos-cards">
                    {data.videos.map((item) => (
                        <Card key={item.video_id} data={item} />
                    ))}
                </CardGrid>
            ) : params.active === "false" ? (
                <h3>Liked Videos Disabled. Enable it in General settings.</h3>
            ) : (
                <></>
            )}
        </div>
    );
};

export default Likedvideos;