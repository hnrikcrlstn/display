$(document).ready(function() {
    $.support.cors = true;
    console.log('Script started');
    fetchTrain();
    fetchJoke();
    fetchWeather();
})

$('#testBtn').on('click' , function() {
    fetchTrain();
    fetchJoke();
    fetchWeather();
    console.log('Button pressed');
});


function fetchTrain() {
    var trainApiUrl = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
    var trainApiKey = '50aff4a70a3749b1b0921745f8d2086d';
    let xmlRequest = "<REQUEST>" +
                        "<LOGIN authenticationkey='"+ trainApiKey + "'/>" +
                        "<QUERY objecttype='TrainAnnouncement' schemaversion='1.8' orderby='AdvertisedTimeAtLocation' limit='150'>" +
                            "<FILTER>" +
                                "<AND>" +
                                    "<EQ name='ActivityType' value='Avgang' />" +
                                    "<EQ name='InformationOwner' value='SL' />" +
                                    "<EQ name='LocationSignature' value='Upv' />" +
                                    "<EQ name='Advertised' value='true' />" +
                                        "<AND>" +
                                                "<GT name='AdvertisedTimeAtLocation' value='$dateadd(-0:30:00)' />" +
                                                "<LT name='AdvertisedTimeAtLocation' value='$dateadd(02:00:00)' />" +
                                        "</AND>" +
                                "</AND>" +
                            "</FILTER>" +
                            "<INCLUDE>ProductInformation</INCLUDE>" +
                            "<INCLUDE>ScheduledDepartureDateTime</INCLUDE>" +
                            "<INCLUDE>EstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>TimeAtLocation</INCLUDE>" +
                            "<INCLUDE>AdvertisedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>ToLocation</INCLUDE>" +
                            "<INCLUDE>LocationSignature</INCLUDE>" +
                            "<INCLUDE>TrackAtLocation</INCLUDE>" +
                            "<INCLUDE>PlannedEstimatedTimeAtLocation</INCLUDE>" +
                            "<INCLUDE>OtherInformation</INCLUDE>" +
                            "<INCLUDE>Canceled</INCLUDE>" +
                            "<INCLUDE>Deviation</INCLUDE>" +
                        "</QUERY>" +
                    "</REQUEST>";
    $.ajax({
        type: "POST",
        url: trainApiUrl,
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
        if(xhr.readyState == 4 && xhr.status < 300) { // readyState 4 means request has finished + we only want to parse the joke if the request was successful (status code lower than 300)
            var randomJoke = JSON.parse(xhr.responseText);

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
    /*  Gather the next 15 departures
     *  Display the upcoming 4 departures
     *  Check for upcoming cancellations */

    let timeNow = Date.now(); /* Still used? */

    /* Reset old data */
    $('.trainDep').removeClass('delay');
    $('.trainDepNew').hide();
    $('.train-error').addClass('train-error-no-error');
    $('.train-error-output').html('');
    $('.trainTimeLabel').text('Tid kvar');

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
    
    console.log(data); /* *** */
    
    /* If there is a canceled departure, store the index in a new array for future handling */
    let errorArray = [];
    
    /* Save number of north and south heading departures */
    let north = 0;
    let south = 0;

    /* Main loop of function, handle the stored train data one at a time */
    for (let i = 0; i < data.length; i++) {
        let direction = northenStations.includes(data[i].ToLocation[0].LocationName);

        /* Checks for cancellations and delays, save train index for future handling */
        if (data[i].Deviation != null) {
            if (data[i].Deviation.length == 1 && !unimportantMessages.includes(data[i].Deviation[0].Description) && (!direction || data[i].ToLocation[0].LocationName == 'U')) {
                console.log('Error level 1, ' + data[i].Deviation[0]); /* *** */
                errorArray.push(i);
            } else if (data[i].Deviation.length > 1) {
                for (let n = 0; n < data[i].Deviation.length; n++) {
                    if (!unimportantMessages.includes(data[i].Deviation[n].Description && (!direction || data[i].ToLocation[n].LocationName == 'U'))) {
                        errorArray.push(i);
                        /* n = data[i].Deviation.length + 1; */ /* Why? */
                    }
                }
            }
        }

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

            if (relevant) {
                if (data[i].Canceled) {
                    $(trainContain).addClass('canceled');
                }

                let trainTimePrint;
                if ((trainTimeEst > 0 && (Math.ceil((trainTimeEst - Date.now()) / 1000 / 60) - 1) == 0) || (trainTimeEst <= 0 && (Math.ceil((trainTime - Date.now()) / 1000 / 60) - 1) == 0  )) {
                    trainTimePrint = 'Avgår nu';
                    $(trainContain + ' .trainTimeLabel').text('');
                } else {
                    trainTimePrint = Math.ceil((trainTime - Date.now()) / 1000 / 60) - 1 + ' <span class="train-time-unit">min</span>';
                }

                $(trainContain + ' .trainDep').text(addZero(trainTime.getHours()) + ':' + addZero(trainTime.getMinutes()));
                $(trainContain + ' .trainTime').html((trainTimePrint));

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
    
    console.log('Script finished'); /* *** */

    if (errorArray.length > 0) {
        $('.train-label-error, .train-error-no-error').removeClass('train-error-no-error');
        for (let i = 0; i < errorArray.length; i++) {
            displayError(data[errorArray[i]].ProductInformation[1].Description, data[errorArray[i]].Deviation[0].Description, data[errorArray[i]].AdvertisedTimeAtLocation, northenStations.includes(data[errorArray[i]].ToLocation[0].LocationName));
        }
    }
}

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
    console.log(weatherData.daily); /* *** */

    /* Current Weather */
    $('.weather-1 .weather-temp .data').text(weatherData.current_weather.temperature);
    $('.weather-1 .weather-wind .data').text(weatherData.current_weather.windspeed);
    $('.weather-1 .weather-status .data').text(interpretWeatherCode(weatherData.current_weather.weathercode));

/*     $('.weather-2 .weather-temp .data').text(weatherData.current_weather.temperature);
    $('.weather-2 .weather-wind .data').text(weatherData.current_weather.windspeed);
    $('.weather-2 .weather-status .data').text(interpretWeatherCode(weatherData.current_weather.weathercode));

    $('.weather-3 .weather-temp .data').text(weatherData.current_weather.temperature);
    $('.weather-3 .weather-wind .data').text(weatherData.current_weather.windspeed);
    $('.weather-3 .weather-status .data').text(interpretWeatherCode(weatherData.current_weather.weathercode)); */

    $('.weather-4 .weather-temp .data').text(weatherData.daily.temperature_2m_min[1] + ' - ' + weatherData.daily.temperature_2m_max[1]);
    $('.weather-4 .weather-wind .data').text(weatherData.daily.windspeed_10m_max[1]);
    $('.weather-4 .weather-status .data').text(interpretWeatherCode(weatherData.daily.weathercode[1]));
}

function interpretWeatherCode(code) {
    /* Translates WMO weather code into readable weather conditions */
    if (code == 0) {
        return 'Molnfritt';
    } else if (code > 1 && code < 4) {
        return 'Molnigt';
    } else if (code == 45 || code == 48) {
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

function addZero(i) {
    /* Used to format time in XX:YY-format */
    if (i < 10) {
        i = '0' + i;
    }
    return i;
}