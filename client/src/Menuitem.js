import React from "react";
import { Link } from "react-router-dom";
import "./Menuitem.css";

const Menuitem = (params) => {
    const handleClick = () => {
        params.onClick();
    };

    const itemClass = params.menu === "Hidden" ? "hiddenitem" : "item";
    const imgClass = params.profile ? "profileimg" : "defaultimg";
    return (
        <Link to={params.head} onClick={handleClick} className="linkedbox">
            <div
                className={
                    params.isSelected ? `${itemClass} selected` : itemClass
                }
            >
                {params.imgpath !== undefined ? (
                    params.menu === "Hidden" ? (
                        <>
                            <img
                                src={params.imgpath}
                                alt={params.title}
                                title={params.title}
                                className="hiddenimg"
                            />
                            <p>{params.title}</p>
                        </>
                    ) : (
                        <>
                            <img
                                src={params.imgpath}
                                alt={params.title}
                                title={params.title}
                                className={imgClass}
                            />
                            <p>{params.title}</p>
                        </>
                    )
                ) : (
                    <h3>{params.title}</h3>
                )}
            </div>
        </Link>
    );
};

export default Menuitem;
