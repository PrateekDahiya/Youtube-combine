import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import Menuitem from "./Menuitem";
import { subscriptionApi } from "./api";
import "./Menu.css";

function Menu(params) {
    const locationHook = useLocation();
    const [subsdata, setsubsData] = useState("");
    const [selectedItem, setSelectedItem] = useState(null);
    const serverurl = process.env.REACT_APP_SERVER_URL;
    const [menu, setMenu] = useState(params.menu !== undefined ? params.menu : (typeof window !== "undefined" && window.innerWidth <= 767 ? "Hidden" : "Full"));
    const [page, setPage] = useState(locationHook.pathname);
    const [isShorts, setIsShorts] = useState("true");
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 767);
    const user = params.user;

    // Only handle mobile detection for responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 767);
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const currentpage = locationHook.pathname;
        setPage(currentpage);
        
        // Set selected item based on current route
        const path = currentpage.split('?')[0]; // Remove query parameters
        switch(path) {
            case '/home':
                setSelectedItem('Home');
                break;
            case '/shorts':
                setSelectedItem('Shorts');
                break;
            case '/subscriptions':
                setSelectedItem('Subscriptions');
                break;
            case '/me':
                setSelectedItem('You');
                break;
            case '/yourchannel':
                setSelectedItem('Your channel');
                break;
            case '/uploads':
                setSelectedItem('Uploads');
                break;
            case '/history':
                setSelectedItem('History');
                break;
            case '/watchlater':
                setSelectedItem('Watch later');
                break;
            case '/likedvideos':
                setSelectedItem('Liked videos');
                break;
            case '/trendings':
                setSelectedItem('Trending');
                break;
            case '/settings':
                setSelectedItem('Settings');
                break;
            case '/category':
                // For category pages, set based on category parameter
                const params = new URLSearchParams(locationHook.search);
                const category = params.get('category');
                if (category) {
                    setSelectedItem(category.charAt(0).toUpperCase() + category.slice(1));
                }
                break;
            default:
                setSelectedItem(null);
        }
    }, [locationHook]);

    // Update menu state based on params
    useEffect(() => {
        if (params.menu) {
            setMenu(params.menu);
        }
    }, [params.menu, params.togglecount]);

    // Update card classes based on menu state
    useEffect(() => {
        if (menu === "Full") {
            const cardElements = document.querySelectorAll(".cards.wider");
            cardElements.forEach((element) => {
                element.classList.remove("wider");
            });
        } else if (menu === "Narrow" || menu === "Hidden") {
            const cardElements = document.querySelectorAll(".cards");
            cardElements.forEach((element) => {
                element.classList.add("wider");
            });
        }
    }, [menu]);

    useEffect(() => {
        if (params.user !== "Guest") {
            const fetchsubs = async () => {
                try {
                    const response = await subscriptionApi.getSubscriptions(user.channel_id);
                    setsubsData(response);
                } catch (error) {
                    console.log("Error fetching subscriptions:", error.message);
                }
            };
            fetchsubs();
        }
    }, [user, page]);

    const handleItemClick = (title) => {
        setSelectedItem(title);
    };

    useEffect(() => {
        setIsShorts(params.isShorts);
    }, [params.isShorts]);

    return (
        <div className={`Menu ${isMobile && menu === "Full" ? "show" : ""}`} data-menu={menu}>
            {menu === "Narrow" ? (
                <div className="HiddenMenu">
                    <Menuitem
                        imgpath="https://cdn-icons-png.flaticon.com/128/1946/1946436.png"
                        title="Home"
                        head="/home"
                        menu="Hidden"
                        isSelected={selectedItem === "Home"}
                        onClick={() => handleItemClick("Home")}
                    />
                    {isShorts === "true" ? (
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/7264/7264012.png"
                            title="Shorts"
                            head="/shorts"
                            menu="Hidden"
                            isSelected={selectedItem === "Shorts"}
                            onClick={() => handleItemClick("Shorts")}
                        />
                    ) : null}

                    <Menuitem
                        imgpath="https://cdn-icons-png.flaticon.com/128/2989/2989849.png"
                        title="Subscriptions"
                        head="/subscriptions"
                        menu="Hidden"
                        isSelected={selectedItem === "Subscriptions"}
                        onClick={() => handleItemClick("Subscriptions")}
                    />
                    <Menuitem
                        imgpath="https://cdn-icons-png.flaticon.com/128/456/456212.png"
                        title="You"
                        head="/me"
                        menu="Hidden"
                        isSelected={selectedItem === "You"}
                        onClick={() => handleItemClick("You")}
                    />
                </div>
            ) : menu === "Hidden" ? (
                <></>
            ) : (
                <div className="fullMenu">
                    <div className="menudiv">
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/1946/1946436.png"
                            title="Home"
                            head="/home"
                            isSelected={selectedItem === "Home"}
                            onClick={() => handleItemClick("Home")}
                        />
                        {isShorts === "true" ? (
                            <Menuitem
                                imgpath="https://cdn-icons-png.flaticon.com/128/7264/7264012.png"
                                title="Shorts"
                                head="/shorts"
                                isSelected={selectedItem === "Shorts"}
                                onClick={() => handleItemClick("Shorts")}
                            />
                        ) : null}

                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/2989/2989849.png"
                            title="Subscriptions"
                            head="/subscriptions"
                            isSelected={selectedItem === "Subscriptions"}
                            onClick={() => handleItemClick("Subscriptions")}
                        />
                    </div>
                    <div className="menudiv">
                        <Menuitem
                            title="You >"
                            head="/me"
                            isSelected={selectedItem === "You"}
                            onClick={() => handleItemClick("You")}
                        />
                        {params.user !== "Guest" ? (
                            <>
                                <Menuitem
                                    imgpath="https://cdn-icons-png.flaticon.com/128/456/456212.png"
                                    title="Your channel"
                                    head="/yourchannel"
                                    isSelected={selectedItem === "Your channel"}
                                    onClick={() =>
                                        handleItemClick("Your channel")
                                    }
                                />
                                <Menuitem
                                    imgpath="https://cdn-icons-png.flaticon.com/128/4189/4189286.png"
                                    title="Uploads"
                                    head="/uploads"
                                    isSelected={selectedItem === "Uploads"}
                                    onClick={() => handleItemClick("Uploads")}
                                />
                            </>
                        ) : (
                            <></>
                        )}

                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/3503/3503786.png"
                            title="History"
                            head="/history"
                            isSelected={selectedItem === "History"}
                            onClick={() => handleItemClick("History")}
                        />
                        {params.user !== "Guest" ? (
                            <>
                                <Menuitem
                                    imgpath="https://cdn-icons-png.flaticon.com/128/15469/15469061.png"
                                    title="Watch later"
                                    head="/watchlater"
                                    isSelected={selectedItem === "Watch later"}
                                    onClick={() =>
                                        handleItemClick("Watch later")
                                    }
                                />
                                <Menuitem
                                    imgpath="https://cdn-icons-png.flaticon.com/128/126/126473.png"
                                    title="Liked videos"
                                    head="/likedvideos"
                                    isSelected={selectedItem === "Liked videos"}
                                    onClick={() =>
                                        handleItemClick("Liked videos")
                                    }
                                />
                            </>
                        ) : (
                            <></>
                        )}
                    </div>

                    {params.user !== "Guest" ? (
                        subsdata.subscription &&
                        subsdata.subscription.length > 0 ? (
                            <div className="menudiv">
                                <h3>Subscriptions</h3>
                                {subsdata.subscription.map((item) => (
                                    <Menuitem
                                        key={item.channel_id}
                                        imgpath={item.channel_icon}
                                        title={item.channel_name}
                                        head={`/channel?channel_id=${item.channel_id}`}
                                        profile={true}
                                        isSelected={
                                            selectedItem === item.channel_name
                                        }
                                        onClick={() =>
                                            handleItemClick(item.channel_name)
                                        }
                                    />
                                ))}
                            </div>
                        ) : null
                    ) : (
                        <div className="menudiv">
                            <h3>Subscriptions</h3>
                            <div className="menuguestuser">
                                <p className="guestuserp">
                                    Sign in to like videos, comment, and
                                    subscribe.
                                </p>
                                <Link
                                    to="/login"
                                    style={{ textDecoration: "none" }}
                                >
                                    <button className="sign_in">
                                        <img
                                            className="guesticon"
                                            src="https://cdn-icons-png.flaticon.com/128/1077/1077063.png"
                                            alt="user"
                                        />
                                        Sign In
                                    </button>
                                </Link>
                            </div>
                        </div>
                    )}

                    <div className="menudiv">
                        <h3>Explore</h3>
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/1946/1946485.png"
                            title="Trending"
                            head="/trendings"
                            isSelected={selectedItem === "Trending"}
                            onClick={() => handleItemClick("Trending")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/2662/2662503.png"
                            title="Shopping"
                            head="/category?category=shopping"
                            isSelected={selectedItem === "Shopping"}
                            onClick={() => handleItemClick("Shopping")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/2995/2995035.png"
                            title="Music"
                            head="/category?category=music"
                            isSelected={selectedItem === "Music"}
                            onClick={() => handleItemClick("Music")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/1179/1179120.png"
                            title="Movies"
                            head="/category?category=movies"
                            isSelected={selectedItem === "Movies"}
                            onClick={() => handleItemClick("Movies")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/686/686589.png"
                            title="Gaming"
                            head="/category?category=gaming"
                            isSelected={selectedItem === "Gaming"}
                            onClick={() => handleItemClick("Gaming")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/1042/1042782.png"
                            title="News"
                            head="/category?category=news"
                            isSelected={selectedItem === "News"}
                            onClick={() => handleItemClick("News")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/1198/1198416.png"
                            title="Sports"
                            head="/category?category=sports"
                            isSelected={selectedItem === "Sports"}
                            onClick={() => handleItemClick("Sports")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/841/841743.png"
                            title="Courses"
                            head="/category?category=courses"
                            isSelected={selectedItem === "Courses"}
                            onClick={() => handleItemClick("Courses")}
                        />
                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/3050/3050198.png"
                            title="Fashion & Beauty"
                            head="/category?category=fashionbeauty"
                            isSelected={selectedItem === "Fashion & Beauty"}
                            onClick={() => handleItemClick("Fashion & Beauty")}
                        />
                    </div>
                    <div className="menudiv">
                        {params.user !== "Guest" ? (
                            <Menuitem
                                imgpath="https://cdn-icons-png.flaticon.com/128/2040/2040504.png"
                                title="Settings"
                                head="/settings"
                                isSelected={selectedItem === "Settings"}
                                onClick={() => handleItemClick("Settings")}
                            />
                        ) : null}

                        <Menuitem
                            imgpath="https://cdn-icons-png.flaticon.com/128/813/813419.png"
                            title="Send feedback"
                            head="/login?type=feedback"
                            isSelected={selectedItem === "Send feedback"}
                            onClick={() => handleItemClick("Send feedback")}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default Menu;
