import React, { useState, useEffect } from "react";
import Card from "./Card";
import axios from "axios";
import { useLocation } from "react-router-dom";
import "./Category.css";
import CardGrid from "./CardGrid";
import Cardloading from "./Cardloading";

const Category = (params) => {
    const locationHook = useLocation();
    const [typeShort, setType] = useState(0);
    const [data, setdata] = useState([]);
    const [loading, setLoading] = useState(true);
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
        setLoading(true);
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
                })
                .finally(() => {
                    setLoading(false);
                });
        };
        fetchData();
    }, [typeShort, category, user]);

    return (
        <>
            {loading ? (
                <Cardloading page="category" />
            ) : data.videos ? (
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
                    <CardGrid variant="category" className="category">
                        {data.videos.map((item) => (
                            <Card key={item.video_id} data={item} />
                        ))}
                    </CardGrid>
                </div>
            ) : (
                <></>
            )}
        </>
    );
};

export default Category;
