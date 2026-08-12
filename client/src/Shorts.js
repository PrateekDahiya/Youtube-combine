import { useEffect, useState } from "react";
import Shortbox from "./Shortbox";
import axios from "axios";
import "./Shorts.css";

const Shorts = (params) => {
    const [shortdata, setShortdata] = useState([]);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [short_index, setShort_index] = useState(0);

    const [activebox, setActivebox] = useState(1);
    const [prevbox, setPrevbox] = useState(-1);
    const [nextbox, setNextbox] = useState(2);
    const [needmore, setNeedmore] = useState(0);
    const [inanimation, setInanimation] = useState(false);
    const [box1data, setBox1data] = useState("");
    const [box2data, setBox2data] = useState("");
    const [box3data, setBox3data] = useState("");

    const handlearrowclick = (arrow) => {
        if (inanimation) return;
        setInanimation(true);
        setTimeout(() => {
            setInanimation(false);
        }, 1000);
        const box1 = document.getElementById("box1");
        const box2 = document.getElementById("box2");
        const box3 = document.getElementById("box3");

        if (arrow === "up" && short_index > 0) {
            setShort_index((prev) => prev - 1);
            if (activebox === 2) {
                box1.classList.add("moveanimate");
                box2.classList.add("moveanimate");
                box3.classList.add("movewanimate");

                box1.style.transform = "translateY(0%)";
                box2.style.transform = "translateY(0%)";
                box3.style.transform = "translateY(-300%)";
                setActivebox(1);
                setPrevbox(3);
                setNextbox(2);
                setTimeout(async () => {
                    box1.classList.remove("moveanimate");
                    box2.classList.remove("moveanimate");
                    box3.classList.remove("movewanimate");
                }, 1000);
            } else if (activebox === 1) {
                box1.classList.add("moveanimate");
                box2.classList.add("movewanimate");
                box3.classList.add("moveanimate");

                box1.style.transform = "translateY(100%)";
                box2.style.transform = "translateY(-200%)";
                box3.style.transform = "translateY(-200%)";
                setActivebox(3);
                setPrevbox(2);
                setNextbox(1);
                setTimeout(async () => {
                    box1.classList.remove("moveanimate");
                    box2.classList.remove("movewanimate");
                    box3.classList.remove("moveanimate");
                }, 1000);
            } else if (activebox === 3) {
                box1.classList.add("movewanimate");
                box2.classList.add("moveanimate");
                box3.classList.add("moveanimate");

                box1.style.transform = "translateY(-100%)";
                box2.style.transform = "translateY(-100%)";
                box3.style.transform = "translateY(-100%)";
                setActivebox(2);
                setPrevbox(1);
                setNextbox(3);
                setTimeout(async () => {
                    box1.classList.remove("movewanimate");
                    box2.classList.remove("moveanimate");
                    box3.classList.remove("moveanimate");
                }, 1000);
            }
        }
        if (arrow === "down") {
            setShort_index((prev) => prev + 1);
            if (activebox === 1) {
                box1.classList.add("moveanimate");
                box2.classList.add("moveanimate");
                box3.classList.add("movewanimate");

                box1.style.transform = "translateY(-100%)";
                box2.style.transform = "translateY(-100%)";
                box3.style.transform = "translateY(-100%)";
                setActivebox(2);
                setPrevbox(1);
                setNextbox(3);
                setTimeout(async () => {
                    box1.classList.remove("moveanimate");
                    box2.classList.remove("moveanimate");
                    box3.classList.remove("movewanimate");
                }, 1000);
            } else if (activebox === 2) {
                box1.classList.add("movewanimate");
                box2.classList.add("moveanimate");
                box3.classList.add("moveanimate");

                box1.style.transform = "translateY(100%)";
                box2.style.transform = "translateY(-200%)";
                box3.style.transform = "translateY(-200%)";
                setActivebox(3);
                setPrevbox(2);
                setNextbox(1);
                setTimeout(async () => {
                    box1.classList.remove("movewanimate");
                    box2.classList.remove("moveanimate");
                    box3.classList.remove("moveanimate");
                }, 1000);
            } else if (activebox === 3) {
                box1.classList.add("moveanimate");
                box2.classList.add("movewanimate");
                box3.classList.add("moveanimate");

                box1.style.transform = "translateY(0%)";
                box2.style.transform = "translateY(0%)";
                box3.style.transform = "translateY(-300%)";
                setActivebox(1);
                setPrevbox(3);
                setNextbox(2);
                setTimeout(async () => {
                    box1.classList.remove("moveanimate");
                    box2.classList.remove("movewanimate");
                    box3.classList.remove("moveanimate");
                }, 1000);
            }
        }
    };

    useEffect(() => {
        if (short_index >= shortdata.length - 20) {
            setNeedmore((prev) => prev + 1);
        }
    }, [short_index]);

    useEffect(() => {
        const fetchShorts = async () => {
            await axios
                .get(
                    `${serverurl}/shorts${
                        window.location.search
                            ? window.location.search + `&needmore=${needmore}`
                            : `?needmore=${needmore}`
                    }`
                )
                .then((response) => {
                    setShortdata((prev) =>
                        prev === null
                            ? response.data.shorts_vIds
                            : prev[0] !== response.data.shorts_vIds[0]
                            ? [...prev, ...response.data.shorts_vIds]
                            : prev
                    );
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchShorts();
    }, [needmore]);

    const [isDelayed, setIsDelayed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (isDelayed) return;

            switch (event.key) {
                case "ArrowUp":
                    handlearrowclick("up");
                    break;
                case "ArrowDown":
                    handlearrowclick("down");
                    break;
                default:
                    break;
            }

            setIsDelayed(true);
            setTimeout(() => {
                setIsDelayed(false);
            }, 1000);
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isDelayed]);

    useEffect(() => {
        if (shortdata.length > 0) {
            setBox1data(
                shortdata[
                    activebox === 1
                        ? short_index
                        : prevbox === 1 && short_index > 0
                        ? short_index - 1
                        : nextbox === 1
                        ? short_index + 1
                        : -1
                ]
            );

            setBox2data(
                shortdata[
                    activebox === 2
                        ? short_index
                        : prevbox === 2 && short_index > 0
                        ? short_index - 1
                        : nextbox === 2
                        ? short_index + 1
                        : -1
                ]
            );

            setBox3data(
                shortdata[
                    activebox === 3
                        ? short_index
                        : prevbox === 3 && short_index > 0
                        ? short_index - 1
                        : nextbox === 3
                        ? short_index + 1
                        : short_index + 2
                ]
            );
        }
    }, [activebox, short_index, prevbox, nextbox, shortdata]);

    return (
        <>
            {shortdata.length > 0 ? (
                <div className="shorts-container">
                    <div className="shorts">
                        <div id="box1" className="short">
                            <Shortbox
                                short={box1data}
                                active={activebox === 1}
                            />
                        </div>
                        <div id="box2" className="short">
                            <Shortbox
                                short={box2data}
                                active={activebox === 2}
                            />
                        </div>
                        <div id="box3" className="short">
                            <Shortbox
                                short={box3data}
                                active={activebox === 3}
                            />
                        </div>
                    </div>
                    <div className="arrows">
                        <img
                            className="arrowup"
                            src="https://cdn-icons-png.flaticon.com/128/608/608336.png"
                            alt="arrowup"
                            title="Previous"
                            onClick={() => {
                                handlearrowclick("up");
                            }}
                        />
                        <img
                            className="arrowdown"
                            src="https://cdn-icons-png.flaticon.com/128/608/608336.png"
                            alt="arrowdown"
                            title="Next"
                            onClick={() => {
                                handlearrowclick("down");
                            }}
                        />
                    </div>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};

export default Shorts;
