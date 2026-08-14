import { useEffect, useState } from "react";
import Card from "./Card";
import { watchlaterApi } from "./api";
import "./Watchlater.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";

const Watchlater = (params) => {
    const [data, setData] = useState("");
    const [loading, setLoading] = useState(true);
    const [user_chl_id, setUser_chl_id] = useState(null);
    const user = params.user;

    useEffect(() => {
        const fetchData = async () => {
            if (!user_chl_id) return;
            try {
                const response = await watchlaterApi.getWatchlater(user_chl_id);
                setData(response);
            } catch (error) {
                console.log("Error fetching watchlater:", error.message);
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
        <div className="watchlater-outerbox">
            <h1>Watch Later</h1>
            {loading ? (
                <Cardloading page="watchlater" />
            ) : data.videos && params.active === "true" ? (
                <CardGrid variant="watchlater" className="watchlater-cards">
                    {data.videos.map((item) => (
                        <Card key={item.video_id} data={item} />
                    ))}
                </CardGrid>
            ) : params.active === "false" ? (
                <h3>Watch Later Disabled. Enable it in General settings.</h3>
            ) : (
                <></>
            )}
        </div>
    );
};

export default Watchlater;