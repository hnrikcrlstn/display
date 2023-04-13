/*
    *   Table of functions
    *   Fetch functions:
    *   fetchTrain() - API call for train info, return data as json
    *   fetchWeather() - API call for weather info, return data as json
    *   fetchJoke() - API call for jokes, return (bool_isOneLine, line_1, line_2/null)
    * 
    *   Display functions:
    *   displayTrainInfo(trainData) - Interpret and prints train data in the train row
    *   displayWeather(weatherData) - Interpret and print weather in the weather row
    *   displayJoke(bool_singleLine, line_1, line_2/null)
    *   displayDates() - Add current time and dates to date-row
    * 
    *   Helper functions:
    *   displayError(trainData, message, time, north) - prints canceled departures or skipped stations in the train row
    *   interpretWeatherCode(code) - Returns the WMO weather code as readable text
    *   addZero(i) - Adds a leading 0 for time (hours or minutes) to allow HH:MM format for single digit hours or minutes
    *   getWeekNumber(date) - Extract a dates week number
*/

$(document).ready(function() {
    $.support.cors = true;

    /* Initiation, fetch data from each part of the display */
    fetchTrain();       // 20 sec
    fetchJoke();        // 5 min
    fetchWeather();     // 1 hour
    displayDates();     // 20 sec

    let tick = 0;       // 1 tick == 1 sec
    setInterval(function timer() {
        // Hourly updates also resets tick count
        if (tick > 60*60 ) {
            fetchWeather();
            fetchJoke();
            fetchTrain();
            displayDates();
            tick = 1;
        } else if (tick % (5*60) == 0) {
            fetchJoke();
            fetchTrain();
            displayDates();
        } else if (tick % 20 == 0) {
            fetchTrain();
            displayDates();
        }
        tick++;
    }, 1000);
});

/*  
    API call to fetch trian data from Trafikverket
    Fetches 30 min retroactivle to display recent canelations, and up to 8 hours from now to display future cancelations 
*/
function fetchTrain() {
    let xmlRequest = "<REQUEST>" +
                        "<LOGIN authenticationkey='50aff4a70a3749b1b0921745f8d2086d'/>" +
                        "<QUERY objecttype='TrainAnnouncement' schemaversion='1.8' orderby='AdvertisedTimeAtLocation' limit='150'>" +
                            "<FILTER>" +
                                "<AND>" +
                                    "<EQ name='ActivityType' value='Avgang' />" +
                                    "<EQ name='InformationOwner' value='SL' />" +
                                    "<EQ name='LocationSignature' value='Upv' />" +
                                    "<EQ name='Advertised' value='true' />" +
                                        "<AND>" +
                                                "<GT name='AdvertisedTimeAtLocation' value='$dateadd(-0:30:00)' />" +
                                                "<LT name='AdvertisedTimeAtLocation' value='$dateadd(08:00:00)' />" +
                                        "</AND>" +
                                "</AND>" +
                            "</FILTER>" +
                            "<INCLUDE>ProductInformation</INCLUDE>" +
                            "<INCLUDE>EstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>TimeAtLocation</INCLUDE>" +
                            "<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>ToLocation</INCLUDE>" +
                            "<INCLUDE>OtherInformation</INCLUDE>" +
                            "<INCLUDE>Canceled</INCLUDE>" +
                            "<INCLUDE>Deviation</INCLUDE>" +
                        "</QUERY>" +
                    "</REQUEST>";
    $.ajax({
        type: "POST",
        url: 'https://api.trafikinfo.trafikverket.se/v2/data.json',
        contentType: "text/xml",
        dataType: "json",
        data: xmlRequest,
        success: function (response) {
            if (response == null) return;
            displayTrainInfo($(response.RESPONSE.RESULT[0].TrainAnnouncement));
        }
    });
}

function fetchJoke() {
    var baseURL = "https://v2.jokeapi.dev";
    var categories = ["Programming", "Misc", "Pun"];
    var params = [
        "blacklistFlags=nsfw,racist"
    ];

    var xhr = new XMLHttpRequest();
    xhr.open("GET", baseURL + "/joke/" + categories.join(",") + "?" + params.join("&"));

    xhr.onreadystatechange = function() {
        // readyState 4 means request has finished + we only want to parse the joke if the request was successful (status code lower than 300)
        if(xhr.readyState == 4 && xhr.status < 300) {
            var randomJoke = JSON.parse(xhr.responseText);
            /* Since jokes are either single line or dual line, displayJoke handeles each type different to be able to add a row break if needed */
            if(randomJoke.type == "single") {
                displayJoke(true, randomJoke.joke, null);
            } else {
                displayJoke(false, randomJoke.setup, randomJoke.delivery);
            }
        }
        else if(xhr.readyState == 4) {
            displayJoke(true, "Error while requesting joke.\n\nStatus code: " + xhr.status + "\nServer response: " + xhr.responseText, null);
        }
    };
    xhr.send();
}

function fetchWeather() {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=59.5222&longitude=17.91&hourly=temperature_2m,apparent_temperature,rain,showers,snowfall,weathercode,cloudcover,windspeed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,rain_sum,snowfall_sum,windspeed_10m_max&current_weather=true&windspeed_unit=ms&forecast_days=2&timezone=Europe%2FBerlin', {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    })
    .then(response => response.json())
    .then(response => displayWeather(response));
}

function displayTrainInfo(data) {

    /* Reset old data */
    $('.trainDep').removeClass('delay');
    $('.train-seg').removeClass('canceled');
    $('.trainDepNew').hide();
    $('.train-label-error').addClass('train-error-no-error');
    $('.train-error-output').html('');
    $('.trainTimeLabel').text('Tid kvar');
    
    /* If there is a canceled departure, store the index in a new array for future handling */
    let errorArray = [];

    /* Save number of north and south heading departures */
    let north = 0;
    let south = 0;

    /* OtherInformations and Deviations to ignore by error handler */
    const unimportantMessages = [
        'Resa förbi Arlanda C kräver både UL- och SL- biljett.', 
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.',
        'Anslutning till linje 48 mot Järna i Södertälje hamn.',
        'Stannar ej vid Trångsund, Skogås, Vega, Jordbro.',
        'Stannar ej vid Arlanda C.',
        'Kort tåg',
        'Spårändrat',
        'Stannar även vid Rosersberg.', 
        'Resa förbi Märsta kräver både UL- och SL- biljett.', 
        'Tåget går endast till Södertälje hamn.',
        'Anslutning till linje 48 mot Gnesta i Södertälje hamn.'];

    /* Array with station id for northen stations, to deduce travel orientation */
    const northenStations = ['U', 'Mr', 'Arnc', 'Kn', 'Rs'];
    
    /* Main loop of function, handle the stored train data one at a time */
    for (let i = 0; i < data.length; i++) {
        let direction = northenStations.includes(data[i].ToLocation[0].LocationName);

        /* Checks for cancellations and delays, save train index for future handling */
        if (data[i].Deviation != null) {
            if (data[i].Deviation.length == 1 && !unimportantMessages.includes(data[i].Deviation[0].Description) && (!direction || data[i].ToLocation[0].LocationName == 'U')) {
                errorArray.push(i);
            } else if (data[i].Deviation.length > 1) {
                for (let n = 0; n < data[i].Deviation.length; n++) {
                    if (!unimportantMessages.includes(data[i].Deviation[n].Description && (!direction || data[i].ToLocation[n].LocationName == 'U'))) {
                        errorArray.push(i);
                        n = data[i].Deviation.length + 1; 
                    }
                }
            }
        }

        /* Only proceed with current departure if there's room to display the train */
        if ((data[i].ToLocation[0].LocationName == 'U' && north < 2) || (!direction && south < 4)) {
            let trainTime = new Date(data[i].AdvertisedTimeAtLocation);
            let trainTimeEst;

            /* Check for new est. time */
            if (data[i].EstimatedTimeAtLocation) {
                trainTimeEst = new Date(data[i].EstimatedTimeAtLocation);
            }
            
            /* Calculate container classes */
            let trainContain;
            if (direction > 0) {
                trainContain = '.train-n-' + north;
            } else {
                trainContain = '.train-s-' + south;
            }

            /* Determine if data post is relevant to display */
            let relevant = false;
            if (trainTime - Date.now() > 0) {
                relevant = true;
            }
            if (data[i].EstimatedTimeAtLocation && trainTimeEst - Date.now() > 0) {
                relevant = true;
            }

            /* If current train departure are irrelevant, ignore it */
            if (relevant) {
                let trainTimePrint;
                /* Instead of 0 min remaining, print Avgår nu */
                if ((trainTimeEst > 0 && (Math.ceil((trainTimeEst - Date.now()) / 1000 / 60) - 1) == 0) || (trainTimeEst <= 0 && (Math.ceil((trainTime - Date.now()) / 1000 / 60) - 1) == 0  )) {
                    trainTimePrint = 'Avgår nu';
                    $(trainContain + ' .trainTimeLabel').text('');
                } else {
                    trainTimePrint = Math.ceil(((trainTimeEst > 0 ? trainTimeEst : trainTime) - Date.now()) / 1000 / 60) - 1 + ' <span class="train-time-unit">min</span>';
                }

                /* Styling of canceled trians */
                if (data[i].Canceled) {
                    $(trainContain).addClass('canceled');
                    $(trainContain + ' .trainTime').text('Inställt');
                } else {
                    /* Styling of remaining time to departure */
                    $(trainContain + ' .trainDep').text(addZero(trainTime.getHours()) + ':' + addZero(trainTime.getMinutes()));
                    $(trainContain + ' .trainTime').html((trainTimePrint));
                }
                /* If time as been changed, notify */
                if (trainTimeEst &&  (Math.round(trainTimeEst - trainTime) / 500 / 60) > 1) {
                    $(trainContain + ' .trainDep').addClass('delay');
                    $(trainContain + ' .trainDepNew').text(addZero(trainTimeEst.getHours()) + ':' + addZero(trainTimeEst.getMinutes())).show();
                }

                /* Keep track of how many north- and southbound trains has been presented */
                if (direction) {
                    north++;
                } else {
                    south++;
                }
            }
        }
    }
    
    /* Check if there's any errors to display */
    if (errorArray.length > 0) {
        $('.train-label-error').removeClass('train-error-no-error');
        for (let i = 0; i < errorArray.length; i++) {
            displayError(data[errorArray[i]].ProductInformation[1].Description, data[errorArray[i]].Deviation[0].Description, data[errorArray[i]].AdvertisedTimeAtLocation, northenStations.includes(data[errorArray[i]].ToLocation[0].LocationName));
        }
    }
}

/* Helper function for formatting and displaying cancelations */
function displayError(trainData, message, time, north) {
    let tempTime = new Date(time);
    let formatedTime = addZero(tempTime.getHours()) + ':' + addZero(tempTime.getMinutes());
    $('.train-error-output').append('<li>' + formatedTime + ', linje ' + trainData + ' ' + (north ? 'norr' : 'söder') + ': ' + message + '</li>');
}

function displayJoke(single, joke, punch) {
    if (single) {
        $('.joke-setup').hide();
        $('.joke-punch-line').text(joke);
    } else {
        $('.joke-setup').show().text(joke);
        $('.joke-punch-line').text(punch);
    }
}

function displayWeather(weatherData) {
    let now = new Date();
    let future3h = now.getHours() + 3;
    let future9h = now.getHours() + 9;
    $('.weather-icon-img').show();

    $('.weather-1 .weather-icon img').attr('src', weatherImg(weatherData.current_weather.weathercode));
    $('.weather-1 .weather-temp .data').text(weatherData.current_weather.temperature);
    $('.weather-1 .weather-wind .data').text(weatherData.current_weather.windspeed);
    $('.weather-1 .weather-status .data').text(interpretWeatherCode(weatherData.current_weather.weathercode));

    $('.weather-2 .weather-icon img').attr('src', weatherImg(weatherData.hourly.weathercode[future3h]));
    $('.weather-2 .weather-temp .data').text(weatherData.hourly.temperature_2m[future3h]);
    $('.weather-2 .weather-wind .data').text(weatherData.hourly.windspeed_10m[future3h]);
    $('.weather-2 .weather-status .data').text(interpretWeatherCode(weatherData.hourly.weathercode[future3h]));

    $('.weather-3 .weather-icon img').attr('src', weatherImg(weatherData.hourly.weathercode[future9h]));
    $('.weather-3 .weather-temp .data').text(weatherData.hourly.temperature_2m[future9h]);
    $('.weather-3 .weather-wind .data').text(weatherData.hourly.windspeed_10m[future9h]);
    $('.weather-3 .weather-status .data').text(interpretWeatherCode(weatherData.hourly.weathercode[future9h]));

    $('.weather-4 .weather-icon img').attr('src', weatherImg(weatherData.daily.weathercode[1]));
    $('.weather-4 .weather-temp .data').text(weatherData.daily.temperature_2m_min[1] + ' - ' + weatherData.daily.temperature_2m_max[1]);
    $('.weather-4 .weather-wind .data').text(weatherData.daily.windspeed_10m_max[1]);
    $('.weather-4 .weather-status .data').text(interpretWeatherCode(weatherData.daily.weathercode[1]));

    /* Error handling, hide images not updated */
    $('.weather-icon-img').each(function() {
        if ($(this).attr('src') == '#') {
            $(this).hide();
        }
    })
}

function displayDates() {
    let now = new Date();

    $('.date-row .date').text(now.getDate() + '/' + now.getMonth());
    $('.date-row .time').text(addZero(now.getHours()) + ':' + addZero(now.getMinutes()));
    $('.date-row .weekNo').text(getWeekNumber(now));

}

/* Translates WMO weather code into readable weather conditions */
function interpretWeatherCode(code) {
    if (code == 0) {
        return 'Molnfritt';
    } else if (code > 1 && code < 10) {
        return 'Molnigt';
    } else if (code > 40 && code < 50) {
        return 'Dimma';
    } else if (code > 50 && code < 60) {
        return 'Duggväder';
    } else if (code > 60 && code < 70) {
        return 'Regnväder';
    }  else if (code > 70 && code < 80) {
        return 'Snöar';
    } else if (code > 80 && code < 90) {
        return 'Spöregnar';
    } else if (code > 94 && code < 100) {
        return 'Åskoväder'
    } else {
        return 'Okänd kod: ' + code;
    }    
}

/* Translate WMO weather code into path to relevant weather icons */
function weatherImg(code) {
    if (code == 0) {
        return '/img/clear-day.svg';
    } else if (code == 1) {
        return '/img/cloudy-1-day.svg';
    } else if (code == 2) {
        return '/img/cloudy-2-day.svg';
    } else if (code == 3) {
        return '/img/cloudy-3-day.svg';
    } else if (code > 40 && code < 50) {
        return '/img/fog.svg';
    } else if (code > 50 && code < 60) {
        return '/img/haze.svg';
    } else if (code == 61) {
        return '/img/rainy-1.svg';
    } else if (code == 63) {
        return '/img/rainy-2.svg';
    } else if (code == 65) {
        return '/img/rainy-3.svg';
    } else if (code == 66 || code == 67 || code == 85 || code == 86) {
        return '/img/snow-and-snow-mix.svg';
    } else if (code == 71) {
        return '/img/snowy-1.svg';
    } else if (code == 73) {
        return '/img/snowy-2.svg';
    } else if (code == 75) {
        return '/img/snow-3.svg';
    } else if (code == 77) {
        return '/img/hail.svg';
    } else if (code == 80) {
        return '/img/rain-1.svg';
    } else if (code == 81) {
        return '/img/rain-2.svg';
    } else if (code == 82) {
        return '/img/rain-3.svg';
    } else if (code == 95 || code == 96 || code == 99) {
        return '/img/thunderstorms.svg';
    } else {
        return '#';
    }    
}

function getWeekNumber(date) {
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // January 4 is always in week 1.
    var week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
           - 3 + (week1.getDay() + 6) % 7) / 7);
}

/* Used to format time in hh:mm-format */
function addZero(i) {
    if (i < 10) {
        i = '0' + i;
    }
    return i;
}