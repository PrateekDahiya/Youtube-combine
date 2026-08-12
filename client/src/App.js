import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Cookies from "js-cookie";
import Menu from "./Menu";
import Header from "./Header";
import Home from "./Home";
import Shorts from "./Shorts";
import You from "./You";
import Watch from "./Watch";
import Subscription from "./Subscription";
import Yourchannel from "./Yourchannel";
import Channel from "./Channel";
import Category from "./Category";
import Search from "./Search";
import Login from "./Login";
import History from "./History";
import Likedvideos from "./Likedvideos";
import Watchlater from "./Watchlater";
import Settings from "./Settings";
import Trendings from "./Trendings";

import "./App.css";

function App() {
    const [crntuser, setCrntuser] = useState("Guest");
    const [menutype, setMenutype] = useState("Full");
    const [toggle, clickedtoggle] = useState(0);
    const [iswatchlater, setIswatchlater] = useState("true");
    const [islikedvideos, setIslikedvideos] = useState("true");
    const [ishistory, setIshistory] = useState("true");
    const [isShorts, setIsShorts] = useState("true");

    const toggleMenu = (action) => {
        if (action === "toggle1") {
            setMenutype(prev => {
                if (prev === "Full") return "Narrow";
                if (prev === "Narrow") return "Full";
                return "Full";
            });
        } else if (action === "toggle2") {
            setMenutype(prev => {
                if (prev === "Full") return "Hidden";
                if (prev === "Hidden") return "Full";
                return "Full";
            });
        } else {
            setMenutype(action);
        }
        clickedtoggle(prev => prev + 1);
    };

    const getUserFromCookie = () => {
        const userCookie = Cookies.get("user");
        try {
            return userCookie ? JSON.parse(userCookie) : "Guest";
        } catch (error) {
            return "Guest";
        }
    };

    const setUser = (user) => {
        setCrntuser(user);
        Cookies.set("user", JSON.stringify(user), { expires: 30 });
    };

    const handleSettings = (change, change_to) => {
        if (change === "watchlater") {
            setIswatchlater(change_to);
            localStorage.setItem("iswatchlater", change_to);
        } else if (change === "likedvideos") {
            setIslikedvideos(change_to);
            localStorage.setItem("islikedvideos", change_to);
        } else if (change === "history") {
            setIshistory(change_to);
            localStorage.setItem("ishistory", change_to);
        } else if (change === "shorts") {
            setIsShorts(change_to);
            localStorage.setItem("isShorts", change_to);
        }
    };

    useEffect(() => {
        const storedIshistory = localStorage.getItem("ishistory");
        const storedIslikedvideos = localStorage.getItem("islikedvideos");
        const storedIswatchlater = localStorage.getItem("iswatchlater");
        const storedIsShorts = localStorage.getItem("isShorts");

        setIshistory(storedIshistory);
        setIslikedvideos(storedIslikedvideos);
        setIswatchlater(storedIswatchlater);
        setIsShorts(storedIsShorts);
    }, [ishistory, islikedvideos, iswatchlater, isShorts]);

    useEffect(() => {
        setCrntuser(getUserFromCookie());
    }, [Cookies.get("user")]);

    return (
        <Router>
            <div className="App">
                <Header onClick={toggleMenu} user={crntuser} />

                <div className="menuncontent">
                    <div className="menu">
                        <Menu
                            menu={menutype}
                            togglecount={toggle}
                            user={crntuser}
                            isShorts={isShorts}
                        />
                    </div>

                    <div className="content">
                        <Routes>
                            <Route
                                path="/"
                                element={<Home user={crntuser} />}
                            />
                            <Route
                                path="/home"
                                element={<Home user={crntuser} />}
                            />
                            <Route path="/search" element={<Search />} />
                            <Route
                                path="/shorts"
                                element={<Shorts user={crntuser} />}
                            />
                            <Route
                                path="/me"
                                element={<You user={crntuser} />}
                            />
                            <Route
                                path="/watch"
                                element={
                                    <Watch
                                        onClick={toggleMenu}
                                        user={crntuser}
                                    />
                                }
                            />
                            <Route
                                path="/yourchannel"
                                element={<Yourchannel user={crntuser} />}
                            />
                            <Route
                                path="/channel"
                                element={<Channel user={crntuser} />}
                            />
                            <Route
                                path="/subscriptions"
                                element={<Subscription user={crntuser} />}
                            />
                            <Route
                                path="/category"
                                element={<Category user={crntuser} />}
                            />
                            <Route
                                path="/trendings"
                                element={<Trendings user={crntuser} />}
                            />
                            <Route
                                path="/history"
                                element={
                                    <History
                                        user={crntuser}
                                        active={ishistory}
                                    />
                                }
                            />
                            <Route
                                path="/likedvideos"
                                element={
                                    <Likedvideos
                                        user={crntuser}
                                        active={islikedvideos}
                                    />
                                }
                            />
                            <Route
                                path="/watchlater"
                                element={
                                    <Watchlater
                                        user={crntuser}
                                        active={iswatchlater}
                                    />
                                }
                            />
                            <Route path="/login" element={<Login />} />
                            <Route
                                path="/settings"
                                element={
                                    <Settings
                                        onClick={toggleMenu}
                                        user={crntuser}
                                        handleSettings={handleSettings}
                                        ishistory={ishistory}
                                        islikedvideos={islikedvideos}
                                        iswatchlater={iswatchlater}
                                        isShorts={isShorts}
                                        setUser={setUser}
                                    />
                                }
                            />
                            <Route
                                path="*"
                                element={
                                    <>
                                        <h1>Error 404</h1>
                                        <h2>Page Not Found</h2>
                                    </>
                                }
                            />
                        </Routes>
                    </div>
                </div>
            </div>
        </Router>
    );
}

export default App;
