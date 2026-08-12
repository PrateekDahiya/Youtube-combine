import { useEffect, useState, useRef } from "react";
import Card from "./Card";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "./Home.css";
import Cardloading from "./Cardloading";

const Home = (params) => {
    const locationHook = useLocation();
    const [data, setData] = useState(null);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [page, setPage] = useState(
        new URLSearchParams(locationHook.pathname)
    );
    const [page_no, setpage_no] = useState(1);
    const [startlistner, setstartlistner] = useState(false);
    const user = params.user;

    useEffect(() => {
        const currentpage = new URLSearchParams(locationHook.pathname);
        setPage(currentpage);
    }, [locationHook]);

    useEffect(() => {
        const fetchData = async () => {
            if (user.channel_id) {
                await axios
                    .get(
                        `${serverurl}/personalized-feed?page=${page_no}&user_id=${user.channel_id}`
                    )
                    .then((response) => {
                        setData((prev) =>
                            prev === null
                                ? response.data.videos
                                : prev[0].video_id !==
                                  response.data.videos[0].video_id
                                ? [...prev, ...response.data.videos]
                                : prev
                        );
                    })
                    .catch((error) => {
                        console.log("Error in fetching: ", error.message);
                    });
            }
            if (user === "Guest") {
                await axios
                    .get(`${serverurl}/home?page=${page_no}`)
                    .then((response) => {
                        setData((prev) =>
                            prev === null
                                ? response.data.videos
                                : prev[0].video_id !==
                                  response.data.videos[0].video_id
                                ? [...prev, ...response.data.videos]
                                : prev
                        );
                    })
                    .catch((error) => {
                        console.log("Error in fetching: ", error.message);
                    });
            }
        };

        fetchData();
    }, [page_no, user.channel_id]);

    const handleScroll = async () => {
        const cards = document.getElementsByClassName("cards")[0];

        if (window.innerHeight + cards.scrollTop - 4 >= cards.scrollHeight) {
            setpage_no((prev) => prev + 1);
        }
    };

    useEffect(() => {
        if (data) {
            const cards = document.getElementsByClassName("cards")[0];
            cards.addEventListener("scroll", handleScroll);
            return () => cards.removeEventListener("scroll", handleScroll);
        }
    }, [startlistner]);

    return (
        <>
            {data ? (
                <>
                    <div
                        className="cards"
                        onLoad={() => {
                            setstartlistner(true);
                        }}
                    >
                        {data.map((item) => (
                            <Card key={item.video_id} data={item} />
                        ))}
                    </div>
                </>
            ) : (
                <Cardloading />
            )}
        </>
    );
};

export default Home;
