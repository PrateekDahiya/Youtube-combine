import React, { useState, useEffect } from "react";
import Card from "./Card";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "./Category.css";

const Category = (params) => {
    const locationHook = useLocation();
    const [typeShort, setType] = useState(0);
    const [data, setdata] = useState([]);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [category, setCategory] = useState(
        new URLSearchParams(locationHook.search).get("category")
    );
    const user = params.user;
    function Heading(string) {
        if (!string) return "";
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    useEffect(() => {
        const currentCategory = new URLSearchParams(locationHook.search).get(
            "category"
        );
        setCategory(currentCategory);
    }, [locationHook]);

    useEffect(() => {
        const fetchData = async () => {
            await axios
                .get(
                    `${serverurl}/category` +
                        "?category=" +
                        category +
                        "&type=" +
                        typeShort
                )
                .then((response) => {
                    setdata(response.data);
                })
                .catch((error) => {
                    console.log("Error in fetching: ", error.message);
                });
        };
        fetchData();
    }, [typeShort, category, user]);

    return (
        <>
            {data.videos ? (
                <div className="categorybox">
                    <div className="heading">
                        <img
                            className="caticon"
                            title={Heading(data.category)}
                            src={data.caticon}
                            alt="category"
                        />
                        <p className="catheading">{Heading(data.category)}</p>
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
                    </div>
                    <div>
                        <hr className="line"></hr>
                    </div>
                    <div className="cards category">
                        {data.videos.map((item) => (
                            <Card key={item.video_id} data={item} />
                        ))}
                    </div>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};

export default Category;
