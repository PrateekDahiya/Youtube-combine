import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import "./Login.css";
import axios from "axios";
import CryptoJS from "crypto-js";
import Cookies from "js-cookie";

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-_]{3,23}$/;
const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%])[a-zA-Z0-9!@#$%]{8,24}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]+$/;
const CHANNEL_ID_REGEX = /^UC[a-zA-Z0-9-_]{22}$/;

function Login(params) {
    const [email, setEmail] = useState("");
    const [validEmail, setValidEmail] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showCPassword, setShowCPassword] = useState(false);
    const [validPassword, setValidPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [username, setUsername] = useState("");
    const [validUsername, setValidUsername] = useState(false);
    const [usernameError, setUsernameError] = useState("");
    const [firstname, setfirstname] = useState("");
    const [validFirstname, setValidFirstname] = useState(false);
    const [firstnameError, setFirstnameError] = useState("");
    const [lastname, setlastname] = useState("");
    const [validLastname, setValidLastname] = useState(false);
    const [lastnameError, setLastnameError] = useState("");
    const [DOB, setDOB] = useState("");
    const [validDOB, setValidDOB] = useState(false);
    const [DOBError, setDOBError] = useState("");
    const [confirm_password, setConfirmpassword] = useState("");
    const [validMatch, setValidMatch] = useState(false);
    const [matchError, setMatchError] = useState("");
    const [channel_name, setChannel_name] = useState("");
    const [validChannel, setValidChannel] = useState(false);
    const [channelError, setChannelError] = useState("");
    const [location, setLocation] = useState("");
    const [validLocation, setValidLocation] = useState(false);
    const [locationError, setLocationError] = useState("");
    const [channel_desc, setChannel_desc] = useState("");
    const [allValid4login, setAllValid4login] = useState(false);
    const [allValid4reg, setAllValid4reg] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [reqchannelid, setReqchannelid] = useState("");
    const [validChannelid, setValidChannelid] = useState(false);
    const [channelidError, setChannelidError] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [ishandlesubmit, setIshandlesubmit] = useState(false);
    const queryParams = new URLSearchParams(window.location.search);
    const type = queryParams.get("type");
    const serverurl = process.env.REACT_APP_SERVER_URL;

    const [i, seti] = useState(
        type === "register" ? 0 : type === "feedback" ? 10 : 8
    );

    const handleNext = async (e) => {
        e.preventDefault();
        seti(i + 1);
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleCPasswordVisibility = () => {
        setShowCPassword(!showCPassword);
    };

    useEffect(() => {
        if (type === "logout") {
            const LogOut = () => {
                Cookies.remove("user");
                window.location.href = "/";
            };
            LogOut();
        }
    }, [type]);

    function sanitizeForSQL(input) {
        return input.replace(/'/g, "''");
    }

    function replaceCharacters(inputString) {
        const replacements = {
            a: "c",
            d: "b",
            " ": "z",
            e: "f",
            f: "g",
            g: "h",
        };

        let modifiedString = "";
        for (let char of inputString) {
            if (replacements[char]) {
                modifiedString += replacements[char];
            } else {
                modifiedString += char;
            }
        }

        return modifiedString;
    }

    function stringToHash(inputString) {
        const sha256Hash = CryptoJS.SHA256(replaceCharacters(inputString));
        const base64Hash = CryptoJS.enc.Base64.stringify(sha256Hash);
        const urlSafeBase64Hash = base64Hash
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        if (urlSafeBase64Hash.length >= 24) {
            return urlSafeBase64Hash.slice(0, 24);
        } else {
            return urlSafeBase64Hash.padEnd(24, "0");
        }
    }

    const setCookie = (user) => {
        Cookies.set("user", JSON.stringify(user), { expires: 30 });
        localStorage.setItem("iswatchlater", "true");
        localStorage.setItem("ishistory", "true");
        localStorage.setItem("islikedvideos", "true");
        localStorage.setItem("isShorts", "true");
    };

    const handleSubmit = async (e, type) => {
        if (ishandlesubmit) {
            return;
        }
        setIshandlesubmit(true);
        const hashpass = stringToHash(password);
        try {
            if (type === "login") {
                const response = await axios.get(`${serverurl}/login`, {
                    params: { username, email, hashpass },
                });
                if (response.data.success) {
                    setCookie(response.data.user);
                    return { success: true };
                } else {
                    return {
                        success: false,
                        message: response.data.message || "Login failed",
                    };
                }
            }

            if (type === "register") {
                const requestData = {
                    email,
                    username,
                    hashpass,
                    fnamefix: sanitizeForSQL(firstname),
                    lnamefix: sanitizeForSQL(lastname),
                    chl_namefix: sanitizeForSQL(channel_name),
                    chl_descfix: sanitizeForSQL(channel_desc),
                    DOB,
                    location,
                };
                const response = await axios.post(
                    `${serverurl}/register`,
                    requestData
                );
                if (response.data.success) {
                    return { success: true };
                } else {
                    return {
                        success: false,
                        message: response.data.message || "Login failed",
                    };
                }
            }

            if (type === "feedback") {
                const requestData = {
                    name: firstname + " " + lastname,
                    feedback: sanitizeForSQL(feedback),
                    reqchannelid,
                };
                const response = await axios.post(
                    `${serverurl}/feedback`,
                    requestData
                );
                return { success: response.data.sent };
            }
        } catch (error) {
            console.error("Error:", error);
            return {
                success: false,
                message: error.message || "An error occurred",
            };
        }
        setIshandlesubmit(false);
    };

    useEffect(() => {
        setValidUsername(USERNAME_REGEX.test(username));
        setUsernameError(
            USERNAME_REGEX.test(username)
                ? ""
                : "Username must contain alteast 4 letters."
        );
    }, [username]);

    useEffect(() => {
        setValidFirstname(
            ALPHANUMERIC_REGEX.test(firstname) && firstname !== ""
        );
        setFirstnameError(
            ALPHANUMERIC_REGEX.test(firstname) && firstname !== ""
                ? ""
                : "First name must contain only alphanumeric characters."
        );
    }, [firstname]);

    useEffect(() => {
        setValidLastname(ALPHANUMERIC_REGEX.test(lastname) || lastname === "");
        setLastnameError(
            ALPHANUMERIC_REGEX.test(lastname) || lastname === ""
                ? ""
                : "Last name must contain only alphanumeric characters."
        );
    }, [lastname]);

    useEffect(() => {
        setValidMatch(password === confirm_password);
        setMatchError(
            password === confirm_password ? "" : "Passwords do not match."
        );
    }, [password, confirm_password]);

    useEffect(() => {
        setValidEmail(EMAIL_REGEX.test(email));
        setEmailError(EMAIL_REGEX.test(email) ? "" : "Invalid email format.");
    }, [email]);

    useEffect(() => {
        setValidPassword(PASSWORD_REGEX.test(password));
        setPasswordError(
            PASSWORD_REGEX.test(password)
                ? ""
                : "Password must contain atleast one of each uppercase, lowercase, number and special character."
        );
    }, [password]);

    useEffect(() => {
        setValidChannel(
            ALPHANUMERIC_REGEX.test(channel_name) && channel_name !== ""
        );
        setChannelError(
            ALPHANUMERIC_REGEX.test(channel_name) && channel_name !== ""
                ? ""
                : "Channel name must contain only alphanumeric characters."
        );
    }, [channel_name]);

    useEffect(() => {
        setValidLocation(location !== "");
        setLocationError(location !== "" ? "" : "Location is required.");
    }, [location]);

    useEffect(() => {
        setValidDOB(DOB !== "");
        setDOBError(DOB !== "" ? "" : "Date of birth is required.");
    }, [DOB]);

    useEffect(() => {
        setValidChannelid(
            CHANNEL_ID_REGEX.test(reqchannelid) || reqchannelid === ""
        );
        setChannelidError(
            CHANNEL_ID_REGEX.test(reqchannelid) || reqchannelid === ""
                ? ""
                : "Invalid Channel id. You can find it at Navigate to youtube channel > click on more details > share channel > copy channel id"
        );
    }, [reqchannelid]);

    useEffect(() => {
        setAllValid4login(
            (validEmail || email === "") &&
                (validUsername || username === "") &&
                validPassword
        );

        setAllValid4reg(
            validEmail &&
                validUsername &&
                validPassword &&
                validMatch &&
                validFirstname &&
                validLastname &&
                validDOB &&
                validChannel &&
                validLocation
        );
    }, [
        validEmail,
        validUsername,
        validPassword,
        validMatch,
        validFirstname,
        validLastname,
        validDOB,
        validChannel,
        validLocation,
    ]);

    return (
        <div className="login-box">
            <div className="form-box">
                <div className="form-box-left">
                    <img
                        className="form-box-logo"
                        alt="formbox"
                        src="https://cdn-icons-png.flaticon.com/128/1384/1384060.png"
                    />
                    <p className="box-head">
                        {i >= 8 && i < 10
                            ? "Sign in"
                            : i < 8
                            ? "Create a VidVault Account"
                            : i >= 10
                            ? "Give your Precious Feedback"
                            : ""}
                    </p>
                    <p className="box-desc">
                        {i === 0
                            ? "Enter your name"
                            : i === 1
                            ? "Create a Username"
                            : i === 2
                            ? "Enter your email"
                            : i === 3
                            ? "Enter your date of birth"
                            : i === 4
                            ? "Set a password"
                            : i === 5
                            ? "Setup your channel"
                            : i === 6
                            ? "Select your country"
                            : i === 7
                            ? "Set channel description"
                            : i === 8
                            ? "Enter your Username"
                            : i === 81
                            ? "Enter your Email"
                            : i === 9
                            ? "Enter your Password"
                            : i === 10
                            ? "Give your Feedback"
                            : i === 11
                            ? "Enter Channel Id"
                            : ""}
                    </p>
                </div>

                {i === 0 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validFirstname ? "valid" : "invalid"}
                                type="text"
                                value={firstname}
                                id="firstname"
                                onChange={(e) => setfirstname(e.target.value)}
                                placeholder="First Name"
                                autoComplete="off"
                                aria-invalid={validFirstname ? "false" : "true"}
                                required
                                autoFocus
                            />
                            {firstnameError && (
                                <p className="error">{firstnameError}</p>
                            )}

                            <br></br>

                            <input
                                className={validLastname ? "valid" : "invalid"}
                                type="text"
                                value={lastname}
                                id="lastname"
                                autoComplete="off"
                                onChange={(e) => setlastname(e.target.value)}
                                placeholder="Last Name (Optional)"
                                aria-invalid={validLastname ? "false" : "true"}
                            />
                            {lastnameError && (
                                <p className="error">{lastnameError}</p>
                            )}
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(8);
                                }}
                            >
                                Already Registered? Login here
                            </span>
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validFirstname && validLastname) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 1 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validUsername ? "valid" : "invalid"}
                                type="text"
                                value={username}
                                id="username"
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Username"
                                autoComplete="off"
                                aria-invalid={validUsername ? "false" : "true"}
                                required
                                autoFocus
                            />
                            {usernameError && (
                                <p className="error">{usernameError}</p>
                            )}
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validUsername) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 2 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validEmail ? "valid" : "invalid"}
                                type="email"
                                value={email}
                                id="email"
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                autoComplete="off"
                                aria-invalid={validEmail ? "false" : "true"}
                                required
                                autoFocus
                            />
                            {emailError && (
                                <p className="error">{emailError}</p>
                            )}
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validEmail) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 3 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validDOB ? "valid" : "invalid"}
                                type="date"
                                value={DOB}
                                id="DOB"
                                autoComplete="off"
                                onChange={(e) => setDOB(e.target.value)}
                                aria-invalid={validDOB ? "false" : "true"}
                                required
                                autoFocus
                            />
                            {DOBError && <p className="error">{DOBError}</p>}
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validDOB) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 4 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <div className="pass-eye-box">
                                <input
                                    className={
                                        validPassword ? "valid" : "invalid"
                                    }
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    id="password"
                                    autoComplete="off"
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="Password"
                                    aria-invalid={
                                        validPassword ? "false" : "true"
                                    }
                                    required
                                    autoFocus
                                />
                                {showPassword ? (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/709/709612.png"
                                        alt="show pass"
                                        title="Show Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                ) : (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                                        alt="hide pass"
                                        title="Hide Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                )}
                            </div>

                            {passwordError && (
                                <p className="error">{passwordError}</p>
                            )}
                            <br></br>
                            <div className="pass-eye-box">
                                <input
                                    className={validMatch ? "valid" : "invalid"}
                                    type={showCPassword ? "text" : "password"}
                                    value={confirm_password}
                                    id="confirm_password"
                                    autoComplete="off"
                                    onChange={(e) =>
                                        setConfirmpassword(e.target.value)
                                    }
                                    aria-invalid={validMatch ? "false" : "true"}
                                    placeholder="Confirm Password"
                                    required
                                />
                                {showCPassword ? (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/709/709612.png"
                                        alt="show pass"
                                        title="Show Password"
                                        onClick={toggleCPasswordVisibility}
                                    />
                                ) : (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                                        alt="hide pass"
                                        title="Hide Password"
                                        onClick={toggleCPasswordVisibility}
                                    />
                                )}
                            </div>

                            {matchError && (
                                <p className="error">{matchError}</p>
                            )}
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validPassword && validMatch) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 5 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validChannel ? "valid" : "invalid"}
                                type="text"
                                value={channel_name}
                                id="channel_name"
                                autoComplete="off"
                                onChange={(e) =>
                                    setChannel_name(e.target.value)
                                }
                                placeholder="Channel Name"
                                aria-invalid={validChannel ? "false" : "true"}
                                required
                                autoFocus
                            />
                            {channelError && (
                                <p className="error">{channelError}</p>
                            )}
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validChannel) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 6 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <select
                                className={validLocation ? "valid" : "invalid"}
                                id="country"
                                name="country"
                                onChange={(e) => setLocation(e.target.value)}
                                aria-invalid={validLocation ? "false" : "true"}
                                aria-placeholder="Select your location"
                            >
                                <option value="">Select your country</option>
                                <option value="AF">Afghanistan</option>
                                <option value="AL">Albania</option>
                                <option value="DZ">Algeria</option>
                                <option value="AS">American Samoa</option>
                                <option value="AD">Andorra</option>
                                <option value="AO">Angola</option>
                                <option value="AI">Anguilla</option>
                                <option value="AQ">Antarctica</option>
                                <option value="AG">Antigua and Barbuda</option>
                                <option value="AR">Argentina</option>
                                <option value="AM">Armenia</option>
                                <option value="AW">Aruba</option>
                                <option value="AU">Australia</option>
                                <option value="AT">Austria</option>
                                <option value="AZ">Azerbaijan</option>
                                <option value="BS">Bahamas</option>
                                <option value="BH">Bahrain</option>
                                <option value="BD">Bangladesh</option>
                                <option value="BB">Barbados</option>
                                <option value="BY">Belarus</option>
                                <option value="BE">Belgium</option>
                                <option value="BZ">Belize</option>
                                <option value="BJ">Benin</option>
                                <option value="BM">Bermuda</option>
                                <option value="BT">Bhutan</option>
                                <option value="BO">Bolivia</option>
                                <option value="BA">
                                    Bosnia and Herzegovina
                                </option>
                                <option value="BW">Botswana</option>
                                <option value="BR">Brazil</option>
                                <option value="IO">
                                    British Indian Ocean Territory
                                </option>
                                <option value="BN">Brunei Darussalam</option>
                                <option value="BG">Bulgaria</option>
                                <option value="BF">Burkina Faso</option>
                                <option value="BI">Burundi</option>
                                <option value="KH">Cambodia</option>
                                <option value="CM">Cameroon</option>
                                <option value="CA">Canada</option>
                                <option value="CV">Cape Verde</option>
                                <option value="KY">Cayman Islands</option>
                                <option value="CF">
                                    Central African Republic
                                </option>
                                <option value="TD">Chad</option>
                                <option value="CL">Chile</option>
                                <option value="CN">China</option>
                                <option value="CO">Colombia</option>
                                <option value="KM">Comoros</option>
                                <option value="CG">Congo</option>
                                <option value="CD">
                                    Congo, the Democratic Republic of the
                                </option>
                                <option value="CK">Cook Islands</option>
                                <option value="CR">Costa Rica</option>
                                <option value="CI">Cote D'Ivoire</option>
                                <option value="HR">Croatia</option>
                                <option value="CU">Cuba</option>
                                <option value="CY">Cyprus</option>
                                <option value="CZ">Czech Republic</option>
                                <option value="DK">Denmark</option>
                                <option value="DJ">Djibouti</option>
                                <option value="DM">Dominica</option>
                                <option value="DO">Dominican Republic</option>
                                <option value="EC">Ecuador</option>
                                <option value="EG">Egypt</option>
                                <option value="SV">El Salvador</option>
                                <option value="GQ">Equatorial Guinea</option>
                                <option value="ER">Eritrea</option>
                                <option value="EE">Estonia</option>
                                <option value="ET">Ethiopia</option>
                                <option value="FK">
                                    Falkland Islands (Malvinas)
                                </option>
                                <option value="FO">Faroe Islands</option>
                                <option value="FJ">Fiji</option>
                                <option value="FI">Finland</option>
                                <option value="FR">France</option>
                                <option value="GF">French Guiana</option>
                                <option value="PF">French Polynesia</option>
                                <option value="TF">
                                    French Southern Territories
                                </option>
                                <option value="GA">Gabon</option>
                                <option value="GM">Gambia</option>
                                <option value="GE">Georgia</option>
                                <option value="DE">Germany</option>
                                <option value="GH">Ghana</option>
                                <option value="GI">Gibraltar</option>
                                <option value="GR">Greece</option>
                                <option value="GL">Greenland</option>
                                <option value="GD">Grenada</option>
                                <option value="GP">Guadeloupe</option>
                                <option value="GU">Guam</option>
                                <option value="GT">Guatemala</option>
                                <option value="GN">Guinea</option>
                                <option value="GW">Guinea-Bissau</option>
                                <option value="GY">Guyana</option>
                                <option value="HT">Haiti</option>
                                <option value="VA">
                                    Holy See (Vatican City State)
                                </option>
                                <option value="HN">Honduras</option>
                                <option value="HK">Hong Kong</option>
                                <option value="HU">Hungary</option>
                                <option value="IS">Iceland</option>
                                <option value="IN">India</option>
                                <option value="ID">Indonesia</option>
                                <option value="IR">
                                    Iran, Islamic Republic of
                                </option>
                                <option value="IQ">Iraq</option>
                                <option value="IE">Ireland</option>
                                <option value="IL">Israel</option>
                                <option value="IT">Italy</option>
                                <option value="JM">Jamaica</option>
                                <option value="JP">Japan</option>
                                <option value="JO">Jordan</option>
                                <option value="KZ">Kazakhstan</option>
                                <option value="KE">Kenya</option>
                                <option value="KI">Kiribati</option>
                                <option value="KP">
                                    Korea, Democratic People's Republic of
                                </option>
                                <option value="KR">Korea, Republic of</option>
                                <option value="KW">Kuwait</option>
                                <option value="KG">Kyrgyzstan</option>
                                <option value="LA">
                                    Lao People's Democratic Republic
                                </option>
                                <option value="LV">Latvia</option>
                                <option value="LB">Lebanon</option>
                                <option value="LS">Lesotho</option>
                                <option value="LR">Liberia</option>
                                <option value="LY">Libya</option>
                                <option value="LI">Liechtenstein</option>
                                <option value="LT">Lithuania</option>
                                <option value="LU">Luxembourg</option>
                                <option value="MO">Macao</option>
                                <option value="MK">
                                    Macedonia, the Former Yugoslav Republic of
                                </option>
                                <option value="MG">Madagascar</option>
                                <option value="MW">Malawi</option>
                                <option value="MY">Malaysia</option>
                                <option value="MV">Maldives</option>
                                <option value="ML">Mali</option>
                                <option value="MT">Malta</option>
                                <option value="MH">Marshall Islands</option>
                                <option value="MQ">Martinique</option>
                                <option value="MR">Mauritania</option>
                                <option value="MU">Mauritius</option>
                                <option value="YT">Mayotte</option>
                                <option value="MX">Mexico</option>
                                <option value="FM">
                                    Micronesia, Federated States of
                                </option>
                                <option value="MD">Moldova, Republic of</option>
                                <option value="MC">Monaco</option>
                                <option value="MN">Mongolia</option>
                                <option value="ME">Montenegro</option>
                                <option value="MS">Montserrat</option>
                                <option value="MA">Morocco</option>
                                <option value="MZ">Mozambique</option>
                                <option value="MM">Myanmar</option>
                                <option value="NA">Namibia</option>
                                <option value="NR">Nauru</option>
                                <option value="NP">Nepal</option>
                                <option value="NL">Netherlands</option>
                                <option value="NC">New Caledonia</option>
                                <option value="NZ">New Zealand</option>
                                <option value="NI">Nicaragua</option>
                                <option value="NE">Niger</option>
                                <option value="NG">Nigeria</option>
                                <option value="NU">Niue</option>
                                <option value="NF">Norfolk Island</option>
                                <option value="MP">
                                    Northern Mariana Islands
                                </option>
                                <option value="NO">Norway</option>
                                <option value="OM">Oman</option>
                                <option value="PK">Pakistan</option>
                                <option value="PW">Palau</option>
                                <option value="PS">Palestine, State of</option>
                                <option value="PA">Panama</option>
                                <option value="PG">Papua New Guinea</option>
                                <option value="PY">Paraguay</option>
                                <option value="PE">Peru</option>
                                <option value="PH">Philippines</option>
                                <option value="PN">Pitcairn</option>
                                <option value="PL">Poland</option>
                                <option value="PT">Portugal</option>
                                <option value="PR">Puerto Rico</option>
                                <option value="QA">Qatar</option>
                                <option value="RE">Reunion</option>
                                <option value="RO">Romania</option>
                                <option value="RU">Russian Federation</option>
                                <option value="RW">Rwanda</option>
                                <option value="BL">Saint Barthelemy</option>
                                <option value="SH">Saint Helena</option>
                                <option value="KN">
                                    Saint Kitts and Nevis
                                </option>
                                <option value="LC">Saint Lucia</option>
                                <option value="MF">
                                    Saint Martin (French part)
                                </option>
                                <option value="PM">
                                    Saint Pierre and Miquelon
                                </option>
                                <option value="VC">
                                    Saint Vincent and the Grenadines
                                </option>
                                <option value="WS">Samoa</option>
                                <option value="SM">San Marino</option>
                                <option value="ST">
                                    Sao Tome and Principe
                                </option>
                                <option value="SA">Saudi Arabia</option>
                                <option value="SN">Senegal</option>
                                <option value="RS">Serbia</option>
                                <option value="SC">Seychelles</option>
                                <option value="SL">Sierra Leone</option>
                                <option value="SG">Singapore</option>
                                <option value="SX">
                                    Sint Maarten (Dutch part)
                                </option>
                                <option value="SK">Slovakia</option>
                                <option value="SI">Slovenia</option>
                                <option value="SB">Solomon Islands</option>
                                <option value="SO">Somalia</option>
                                <option value="ZA">South Africa</option>
                                <option value="GS">
                                    South Georgia and the South Sandwich Islands
                                </option>
                                <option value="SS">South Sudan</option>
                                <option value="ES">Spain</option>
                                <option value="LK">Sri Lanka</option>
                                <option value="SD">Sudan</option>
                                <option value="SR">Suriname</option>
                                <option value="SJ">
                                    Svalbard and Jan Mayen
                                </option>
                                <option value="SZ">Swaziland</option>
                                <option value="SE">Sweden</option>
                                <option value="CH">Switzerland</option>
                                <option value="SY">Syrian Arab Republic</option>
                                <option value="TW">
                                    Taiwan, Province of China
                                </option>
                                <option value="TJ">Tajikistan</option>
                                <option value="TZ">
                                    Tanzania, United Republic of
                                </option>
                                <option value="TH">Thailand</option>
                                <option value="TL">Timor-Leste</option>
                                <option value="TG">Togo</option>
                                <option value="TK">Tokelau</option>
                                <option value="TO">Tonga</option>
                                <option value="TT">Trinidad and Tobago</option>
                                <option value="TN">Tunisia</option>
                                <option value="TR">Turkey</option>
                                <option value="TM">Turkmenistan</option>
                                <option value="TC">
                                    Turks and Caicos Islands
                                </option>
                                <option value="TV">Tuvalu</option>
                                <option value="UG">Uganda</option>
                                <option value="UA">Ukraine</option>
                                <option value="AE">United Arab Emirates</option>
                                <option value="GB">United Kingdom</option>
                                <option value="US">United States</option>
                                <option value="UM">
                                    United States Minor Outlying Islands
                                </option>
                                <option value="UY">Uruguay</option>
                                <option value="UZ">Uzbekistan</option>
                                <option value="VU">Vanuatu</option>
                                <option value="VE">Venezuela</option>
                                <option value="VN">Viet Nam</option>
                                <option value="VG">
                                    Virgin Islands, British
                                </option>
                                <option value="VI">Virgin Islands, U.S.</option>
                                <option value="WF">Wallis and Futuna</option>
                                <option value="EH">Western Sahara</option>
                                <option value="YE">Yemen</option>
                                <option value="ZM">Zambia</option>
                                <option value="ZW">Zimbabwe</option>
                            </select>
                            <br></br>
                            {locationError && (
                                <p className="error">{locationError}</p>
                            )}
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validLocation) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 7 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                type="text"
                                value={channel_desc}
                                id="channel_desc"
                                autoComplete="off"
                                onChange={(e) =>
                                    setChannel_desc(e.target.value)
                                }
                                placeholder="Channel Description (Optional)"
                                autoFocus
                            />
                            {errorMessage && (
                                <div className="error">{errorMessage}</div>
                            )}
                            <br></br>
                            <button
                                type="submit"
                                onClick={async (e) => {
                                    if (allValid4reg) {
                                        const result = await handleSubmit(
                                            e,
                                            "register"
                                        );
                                        if (result.success) {
                                            window.location.href = "/login";
                                        } else {
                                            setErrorMessage(
                                                result.message ||
                                                    "Registration failed"
                                            );
                                        }
                                    }
                                }}
                            >
                                Submit
                            </button>
                        </div>
                    </form>
                ) : i === 8 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validUsername ? "valid" : "invalid"}
                                type="text"
                                value={username}
                                id="username"
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Username"
                                required
                                autoFocus
                            />
                            {usernameError && (
                                <p className="error">{usernameError}</p>
                            )}
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(81);
                                }}
                            >
                                Forgot username? Try using Email
                            </span>
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(0);
                                }}
                            >
                                New? Register now
                            </span>
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validUsername) {
                                        handleNext(e);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 81 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validEmail ? "valid" : "invalid"}
                                type="email"
                                value={email}
                                id="email"
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                                required
                                autoFocus
                            />
                            {emailError && (
                                <p className="error">{emailError}</p>
                            )}
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(8);
                                }}
                            >
                                Forgot email? Try using username
                            </span>
                            <br></br>
                            <span
                                className="login-ques"
                                onClick={(e) => {
                                    e.preventDefault();
                                    seti(0);
                                }}
                            >
                                New? Register now
                            </span>
                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validEmail) {
                                        e.preventDefault();
                                        seti(9);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 9 ? (
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            if (validPassword && allValid4login) {
                                const result = await handleSubmit(e, "login");
                                if (result.success) {
                                    window.location.href = "/home";
                                } else {
                                    setErrorMessage(
                                        result.message || "Invalid credentials"
                                    );
                                }
                            }
                        }}
                    >
                        <div className="inputdata">
                            <div className="pass-eye-box">
                                <input
                                    className={
                                        validPassword ? "valid" : "invalid"
                                    }
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="Password"
                                    required
                                    autoFocus
                                />
                                {showPassword ? (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/709/709612.png"
                                        alt="show pass"
                                        title="Show Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                ) : (
                                    <img
                                        className="pass-eye"
                                        src="https://cdn-icons-png.flaticon.com/128/2767/2767146.png"
                                        alt="hide pass"
                                        title="Hide Password"
                                        onClick={togglePasswordVisibility}
                                    />
                                )}
                            </div>

                            {passwordError && (
                                <p className="error">{passwordError}</p>
                            )}
                            {errorMessage && (
                                <div className="error">{errorMessage}</div>
                            )}
                            <br></br>
                            <button type="submit">Submit</button>
                        </div>
                    </form>
                ) : i === 10 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <input
                            className={validFirstname ? "valid" : "invalid"}
                            type="text"
                            value={firstname}
                            id="firstname"
                            onChange={(e) => setfirstname(e.target.value)}
                            placeholder="First Name"
                            autoComplete="off"
                            aria-invalid={validFirstname ? "false" : "true"}
                            required
                            autoFocus
                        />
                        {firstnameError && (
                            <p className="error">{firstnameError}</p>
                        )}

                        <input
                            className={validLastname ? "valid" : "invalid"}
                            type="text"
                            value={lastname}
                            id="lastname"
                            autoComplete="off"
                            onChange={(e) => setlastname(e.target.value)}
                            placeholder="Last Name (Optional)"
                            aria-invalid={validLastname ? "false" : "true"}
                        />
                        {lastnameError && (
                            <p className="error">{lastnameError}</p>
                        )}
                        <div className="inputdata">
                            <textarea
                                className="valid"
                                value={feedback}
                                id="feedback"
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Feedback"
                                required
                                autoFocus
                            />

                            <br></br>
                            <button
                                className="next-btn"
                                onClick={(e) => {
                                    if (validFirstname) {
                                        e.preventDefault();
                                        seti(11);
                                    }
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </form>
                ) : i === 11 ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                        }}
                    >
                        <div className="inputdata">
                            <input
                                className={validChannelid ? "valid" : "invalid"}
                                type="text"
                                value={reqchannelid}
                                id="channel_id"
                                onChange={(e) =>
                                    setReqchannelid(e.target.value)
                                }
                                placeholder="Channel id"
                                autoFocus
                            />
                            {channelidError && (
                                <p className="error">{channelidError}</p>
                            )}
                            {errorMessage && (
                                <div className="error">{errorMessage}</div>
                            )}

                            <br></br>
                            <button
                                type="submit"
                                onClick={async (e) => {
                                    if (validChannelid) {
                                        const result = await handleSubmit(
                                            e,
                                            "feedback"
                                        );
                                        if (result.success) {
                                            window.location.href = `${
                                                reqchannelid.length > 0
                                                    ? `/channel?channel_id=${reqchannelid}`
                                                    : "/home"
                                            }`;
                                        } else {
                                            setErrorMessage(
                                                result.message ||
                                                    "Feedback submission failed"
                                            );
                                            NavLink.replace("/home");
                                        }
                                    }
                                }}
                            >
                                Submit
                            </button>
                        </div>
                    </form>
                ) : (
                    <></>
                )}
            </div>
        </div>
    );
}

export default Login;
