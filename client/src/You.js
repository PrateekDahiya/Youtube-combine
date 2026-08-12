import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./You.css";

const You = (params) => {
    const [data, setData] = useState("");
    // const [videos, setVideos] = useState("");
    // const [typeShort, setType] = useState(0);
    const serverurl = process.env.REACT_APP_SERVER_URL;

    const user = params.user;
    useEffect(() => {
        const fetchData = async () => {
            await axios
                .get(`${serverurl}/yourchannel?channel_id=${user.channel_id}`)
                .then((response) => {
                    setData(response.data.channel[0]);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchData();
    }, [user]);

    // function formatNumber(num) {
    //     if (num >= 1000000) {
    //         return (num / 1000000).toFixed(1) + "M";
    //     } else if (num >= 1000) {
    //         return (num / 1000).toFixed(1) + "K";
    //     } else {
    //         return num.toString();
    //     }
    // }

    return (
        <>
            {params.user !== "Guest" ? (
                <>
                    {data ? (
                        <div className="outer">
                            {data.channel_banner ? (
                                data.channel_banner !== "N/A" ? (
                                    <div className="banner">
                                        <img
                                            alt="channel_banner"
                                            src={data.channel_banner}
                                            title="Channel Banner"
                                        />
                                    </div>
                                ) : (
                                    ""
                                )
                            ) : (
                                ""
                            )}
                            <div className="channelinfo">
                                <img
                                    className="mypic"
                                    alt="Profile"
                                    title={data.channel_name}
                                    src={data.channel_icon}
                                />
                                <div className="details">
                                    <p className="name">{data.channel_name}</p>
                                    <Link
                                        to="/yourchannel"
                                        style={{ textDecoration: "none" }}
                                    >
                                        <p className="id">
                                            {data.custom_url}
                                            {" • "}
                                            view Channel
                                        </p>
                                    </Link>

                                    <div className="mebuttons">
                                        <button className="switchaccount">
                                            Switch Account
                                        </button>
                                        <button className="gaccount">
                                            Google Account
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p>loading...</p>
                    )}
                </>
            ) : (
                <div className="guestuser">
                    <img
                        className="bigicon"
                        src="https://cdn-icons-png.flaticon.com/128/456/456212.png"
                        alt="subscriptions"
                    />
                    <h2>Enjoy your favorite videos</h2>
                    <h3>Sign in to access videos that you've liked or saved</h3>
                    <Link to="/login" style={{ textDecoration: "none" }}>
                        <button className="sign_in">
                            <img
                                className="guesticon"
                                src="https://cdn-icons-png.flaticon.com/128/1077/1077063.png"
                                alt="user"
                                title="Sign In"
                            />
                            Sign In
                        </button>
                    </Link>
                </div>
            )}
        </>
    );
};

export default You;
