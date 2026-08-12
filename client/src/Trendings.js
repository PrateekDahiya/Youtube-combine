import React, { useState, useEffect } from "react";
import Card from "./Card";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "./Trendings.css";

const Trendings = (params) => {
    const locationHook = useLocation();
    const [type, setType] = useState(0);
    const [data, setdata] = useState([]);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [page, setPage] = useState(
        new URLSearchParams(locationHook.pathname)
    );
    const user = params.user;

    useEffect(() => {
        const currentpage = new URLSearchParams(locationHook.pathname);
        setPage(currentpage);
    }, [locationHook]);

    useEffect(() => {
        const fetchData = async () => {
            await axios
                .get(`${serverurl}/trendings?type=${type}`)
                .then((response) => {
                    setdata(response.data);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchData();
    }, [type, user, page]);

    return (
        <>
            {data.videos ? (
                <div className="trendingbox">
                    <div className="trend-heading">
                        <img
                            className="caticon"
                            src="https://cdn-icons-png.flaticon.com/128/1946/1946430.png"
                            alt="trending"
                            title="Trending"
                        />
                        <p className="trendheading">Trendings</p>
                    </div>
                    <div className="menus trend-menus">
                        <p
                            className={
                                "menubutton " + (type === 0 ? "active" : "")
                            }
                            onClick={() => {
                                setType(0);
                            }}
                        >
                            Now
                        </p>
                        <p
                            className={
                                "menubutton " + (type === 1 ? "active" : "")
                            }
                            onClick={() => {
                                setType(1);
                            }}
                        >
                            Music
                        </p>
                        <p
                            className={
                                "menubutton " + (type === 2 ? "active" : "")
                            }
                            onClick={() => {
                                setType(2);
                            }}
                        >
                            Gaming
                        </p>
                        <p
                            className={
                                "menubutton " + (type === 3 ? "active" : "")
                            }
                            onClick={() => {
                                setType(3);
                            }}
                        >
                            Movies
                        </p>
                    </div>
                    <div>
                        <hr className="line"></hr>
                    </div>
                    <div className="cards trendings">
                        {data.videos.map((item) => (
                            <Card
                                key={item.video_id}
                                data={item}
                                forTrending={true}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};

export default Trendings;
