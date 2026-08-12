import { useEffect, useState } from "react";
import Card from "./Card";
import axios from "axios";
import "./Watchlater.css";

const Watchlater = (params) => {
    const [data, setData] = useState("");
    const [user_chl_id, setUser_chl_id] = useState(null);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const user = params.user;

    useEffect(() => {
        const fetchData = async () => {
            await axios
                .get(`${serverurl}/watchlater?user_id=${user_chl_id}`)
                .then((response) => {
                    setData(response.data);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchData();
    }, [user_chl_id]);

    useEffect(() => {
        setUser_chl_id(user.channel_id);
    }, [user]);

    return (
        <div className="watchlater-outerbox">
            <h1>Watch Later</h1>
            {data.videos && params.active === "true" ? (
                <div className="watchlater-cards">
                    {data.videos.map((item) => (
                        <Card key={item.video_id} data={item} />
                    ))}
                </div>
            ) : params.active === "false" ? (
                <h3>Watch Later Disabled. Enable it in General settings.</h3>
            ) : (
                <></>
            )}
        </div>
    );
};

export default Watchlater;
