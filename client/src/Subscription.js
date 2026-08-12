import React, { useState, useEffect } from "react";
import Card from "./Card";
import { Link } from "react-router-dom";
import axios from "axios";
import "./Subscription.css";

const Subscription = (params) => {
    const [videos, setVideos] = useState([]);
    const [typeShort, setType] = useState(0);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const user = params.user;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(
                    `${serverurl}/subscriptions?isShort=${typeShort}&user_id=${user.channel_id}`
                );
                setVideos(response.data);
            } catch (error) {
                console.log("Error in fetching: ", error.message);
            }
        };
        fetchData();
    }, [typeShort, user.channel_id, serverurl, user]);

    return (
        <>
            {params.user !== "Guest" ? (
                <div className="subsbox">
                    <h1>Subscriptions</h1>
                    <h3>Latest</h3>
                    <div className="menus">
                        <p
                            className={
                                "menubutton " +
                                (typeShort === 0 ? "active" : "")
                            }
                            onClick={() => {
                                setType(0);
                            }}
                        >
                            Videos
                        </p>
                        <p
                            className={
                                "menubutton " +
                                (typeShort === 1 ? "active" : "")
                            }
                            onClick={() => {
                                setType(1);
                            }}
                        >
                            Shorts
                        </p>
                    </div>
                    {videos.data ? (
                        <div className="cards">
                            {videos.data.map((item) => (
                                <Card key={item.video_id} data={item} />
                            ))}
                        </div>
                    ) : (
                        <></>
                    )}
                </div>
            ) : (
                <div className="guestuser">
                    <img
                        className="bigicon"
                        src="https://cdn-icons-png.flaticon.com/128/2989/2989849.png"
                        alt="subscriptions"
                        title="Subscriptions"
                    />
                    <h2>Don't miss new videos</h2>
                    <h3>
                        Sign in to see updates from your favorite VidVault
                        channels
                    </h3>
                    <Link to="/login" style={{ textDecoration: "none" }}>
                        <button className="sign_in">
                            <img
                                className="guesticon"
                                title="Sign In"
                                src="https://cdn-icons-png.flaticon.com/128/1077/1077063.png"
                                alt="user"
                            />
                            Sign In
                        </button>
                    </Link>
                </div>
            )}
        </>
    );
};

export default Subscription;
