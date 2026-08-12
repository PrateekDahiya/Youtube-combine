import React, { useEffect, useState } from "react";
import "./Yourchannel.css";
import axios from "axios";
import Cardloading from "./Cardloading";
import Card from "./Card";

const Yourchannel = (params) => {
    const [data, setData] = useState("");
    const [videos, setVideos] = useState("");
    const [typeShort, setType] = useState(0);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const user = params.user;

    useEffect(() => {
        const fetchData = async () => {
            try {
                let getreq = `${serverurl}/yourchannel?channel_id=${user.channel_id}`;
                const response = await fetch(getreq);
                const jsonData = await response.json();
                setData(jsonData.channel[0]);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [user]);

    useEffect(() => {
        const fetchVideos = async () => {
            await axios
                .get(
                    `${serverurl}/getvideosofchannel?channel_id=${user.channel_id}&type=${typeShort}`
                )
                .then((response) => {
                    setVideos(response.data);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchVideos();
    }, [typeShort, user]);

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + "M";
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + "K";
        } else {
            return num.toString();
        }
    }

    function formatNumberWithCommas(number) {
        return number.toLocaleString();
    }

    function formatISODate(isoDate) {
        const date = new Date(isoDate);
        const options = { year: "numeric", month: "short", day: "numeric" };
        return date.toLocaleDateString("en-US", options);
    }
    function show_moredesc() {
        let x = document.querySelector(".moredesc");
        if (x.style.display === "none") {
            x.style.display = "block";
        } else {
            x.style.display = "none";
        }
    }

    function close_moredesc() {
        let x = document.querySelector(".moredesc");
        if (x.style.display === "block") {
            x.style.display = "none";
        } else {
            x.style.display = "block";
        }
    }

    function getshortinfo(str) {
        if (str.length <= 50) {
            return str;
        }
        const lastSpaceIndex = str.substring(0, 65).lastIndexOf(" ");
        return str.substring(0, lastSpaceIndex);
    }

    return (
        <>
            {data ? (
                <div className="outer">
                    {data.channel_banner !== "N/A" ? (
                        <div className="banner">
                            <img
                                alt="channel_banner"
                                src={data.channel_banner}
                                title="Channel Banner"
                            />
                        </div>
                    ) : (
                        ""
                    )}
                    <div className="channelinfo">
                        <img
                            className="mypic"
                            alt="Profile"
                            src={data.channel_icon}
                            title={data.channel_name}
                        />
                        <div className="details">
                            <p className="name">{data.channel_name}</p>
                            <p className="id">
                                {data.custom_url}
                                {" • "}
                                {formatNumber(data.subscribers)}
                                {" subscribers • "}
                                {formatNumber(data.video_count)}
                                {" videos"}
                            </p>
                            <p
                                className="desc"
                                onClick={() => {
                                    show_moredesc();
                                }}
                            >
                                {getshortinfo(data.short_desc)}...
                                <b>more</b>
                            </p>
                            <div className="moredesc">
                                <p className="deschead">
                                    About
                                    <span
                                        className="close-btn"
                                        onClick={() => {
                                            close_moredesc();
                                        }}
                                    >
                                        X
                                    </span>
                                </p>
                                <p className="descdata">{data.short_desc}</p>
                                <p className="deschead">Channel details</p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/900/900782.png"
                                    />
                                    /channel?channel_id=
                                    {data.channel_id}
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/825/825636.png"
                                    />
                                    {formatNumber(data.subscribers)} subscribers
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/1179/1179120.png"
                                    />
                                    {formatNumber(data.video_count)}
                                    {""}
                                    videos
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/3742/3742162.png"
                                    />
                                    {formatNumberWithCommas(data.total_views)}{" "}
                                    views
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/2342/2342329.png"
                                    />
                                    Joined {formatISODate(data.date_created)}
                                </p>
                                <p className="descdata">
                                    <img
                                        alt="datashow"
                                        src="https://cdn-icons-png.flaticon.com/128/2838/2838912.png"
                                    />
                                    {data.location}
                                </p>
                            </div>
                        </div>
                    </div>
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
                        <p className="menubutton">Search Channel</p>
                        <input type="text" placeholder="Search" />
                        <img
                            alt="searchchannel"
                            src="https://cdn-icons-png.flaticon.com/128/2811/2811806.png"
                            title="Search"
                        />
                    </div>
                    {videos.data ? (
                        <div className="videos">
                            {videos.videos.map((item) => (
                                <Card key={item.video_id} data={item} />
                            ))}
                        </div>
                    ) : (
                        <></>
                    )}
                </div>
            ) : (
                <Cardloading page="yourchannel" />
            )}
        </>
    );
};

export default Yourchannel;
