import React, { useState, useEffect } from "react";
import Card from "./Card";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "./Trendings.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";

const Trendings = (params) => {
    const locationHook = useLocation();
    const [type, setType] = useState(0);
    const [data, setdata] = useState([]);
    const [loading, setLoading] = useState(true);
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
        setLoading(true);
        const fetchData = async () => {
            await axios
                .get(`${serverurl}/trendings?type=${type}`)
                .then((response) => {
                    setdata(response.data);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        };
        fetchData();
    }, [type, user, page]);

    return (
        <>
            {loading ? (
                <Cardloading page="trendings" />
            ) : data.videos ? (
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
                    <CardGrid variant="trending" className="trendings">
                        {data.videos.map((item) => (
                            <Card
                                key={item.video_id}
                                data={item}
                                forTrending={true}
                            />
                        ))}
                    </CardGrid>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};

export default Trendings;
