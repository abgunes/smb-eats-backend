const axios = require("axios")
var TOKEN;

module.exports = {
    StartInstance: function (context) {
        //Starts a new WF instance
        return (StartInstance(context));
    },
    GetTasks: function (user) {
        //Retrieve tasks for a given (UI) user. 
        return (GetTasks(user));
    },
    GetOpenTaskOnInstance: function (instanceID) {
        //Retrive the open task on a worfklow instance
        return (GetOpenTaskOnInstance(instanceID));
    },
    GetTaskContext: function (taskId) {
        //Retrive the context (user data) of a task
        return (GetTaskContext(taskId));
    },
    CompleteTask: function (taskId) {
        //PATCH a task to complete and continue the workflow
        return (CompleteTask(taskId));
    }
}

let StartInstance = function (context) {
    //Starts the Workflow Instance. The beggining of the process
    return new Promise(function (resolve, reject) {    
        const data = {
            definitionId: process.env.WF_DEFINITION,
            context: context}
    
        axios.request({
            url: "/v1/workflow-instances",
            method: "POST",
            baseURL: process.env.WF_REST_URL,
            data: data
        }).then((res) => {
            console.log("Instance "+res.data.id+ " Created Successfully")
            resolve(res.data)
        }).catch((err) => {
            handleResponseError(err)
            reject(err)
        });
    })
}

let GetTasks = function (user) {
    //Fetch all open (READY) task instances for a given activity(id)
    return new Promise(function (resolve, reject) {    
        const activityId = convertUserToActivity(user)       
        if (!activityId) {
            reject("Invalid User - " + user)
        }else{
            console.log("Retrieving Tasks from Workflow for User " + user)
            axios.request({
                url: "/v1/task-instances",
                method: "GET",
                baseURL: process.env.WF_REST_URL,
                params: {
                    "status": "READY",
                    "activityId": activityId
                }
            }).then((res) => {
                var tasks = res.data

                console.log(tasks.length +" Tasks open for user " + user)
                console.log("Retrieving Context for each task")

                var getTaskContext = []
                tasks.forEach(task => {
                    getTaskContext.push(GetTaskContext(task))
                })
                
                Promise.all(getTaskContext).then((newdata) => {
                    resolve(newdata)
                });;                
            }).catch((err) => {
                handleResponseError(err)
                reject(err)
            });
        }
    })
}

let GetOpenTaskOnInstance = function (instanceID) {
    //Fetch all open (READY) task instances for a given workflow(id)
    //This should be the last task (Rider going to deliver)
    return new Promise(function (resolve, reject) {    
        console.log("Retrieving Open task on Worfklow Instance "+instanceID)       
        axios.request({
            url: "/v1/task-instances",
            method: "GET",
            baseURL: process.env.WF_REST_URL,
            params: {
                "status": "READY",
                "workflowInstanceId": instanceID
            }
        }).then((res) => {
            console.log("Found "+res.data.length +  " Open tasks on WF instance "+ instanceID)
            if(res.data.length == 0){
                console.log("RETRYING!!")
                resolve(GetOpenTaskOnInstance(instanceID))
            }else{
                resolve(res.data)
            }
            resolve(res.data)
        }).catch((err) => {
            handleResponseError(err)
            reject(err)
        });
    })

}

let GetTaskContext = function (task) {
    //fetch the context (user data) of a task (retrieved by GetTasks)
    //In this case, name, address, etc..
    return new Promise(function (resolve, reject) {    
        
        var taskDetails;
        var taskId;

        if(task.id){
            taskDetails = task;
            taskId = task.id
        }else{
            if (task){
                taskId = task
            }else{
                reject("Invalid Task ID - " + task.id)
                return
            }
        }
        axios.request({
            url: "/v1/task-instances/"+taskId+"/context",
            method: "GET",
            baseURL: process.env.WF_REST_URL,
        }).then((res) => {
            console.log("Context retrievd for task " + taskId)
            var newData = {}
            if (taskDetails){
                newData = taskDetails
            }
            newData.context = res.data
            resolve(newData)
        }).catch((err) => {
            handleResponseError(err)
            reject(err)
        });
    
    })
}

let CompleteTask = function (taskId) {
    //Mark Task as completed
    return new Promise(function (resolve, reject) {    
        if (!taskId) {
            reject("Invalid Task ID - " + taskId)
        }else{
            axios.request({
                url: "/v1/task-instances/"+taskId,
                method: "PATCH",
                baseURL: process.env.WF_REST_URL,
                data: {"context": {},"status": "COMPLETED"}
            }).then((res) => {
                console.log("Task "+ taskId + " completed!")
                resolve(res.data)
            }).catch((err) => {
                handleResponseError(err)
                reject(err)
            });
        }
    })
}


let getAccessToken = () => {
    //Get the Oauth2 access token and store it as defaults of the axios client
    return new Promise(function (resolve, reject) {
        axios.request({
            url: "/oauth/token",
            method: "POST",
            baseURL: process.env.AUTH_URL,
            auth: {
                username: process.env.AUTH_CLIENT_ID,
                password: process.env.AUTH_CLIENT_SECRET
            },
            params: {
                "grant_type": "client_credentials",
                // "scope": ""
            }
        }).then((res) => {
            console.log("Oauth Token retrieved Succesfully!");
            axios.defaults.headers.common['Authorization'] = "Bearer "+res.data.access_token;
            resolve(res.data.access_token)
        }).catch((error) => {
            console.error(error)
        });
    })
}

function convertUserToActivity(user) {
    //Each Area has an activity. The tasks are assigned to the areas.
    //This is a from/to reference between Areas x Activity types
    switch (user) {
        case "kitchen":
            return process.env.ACTIVITY_KITCHEN
            break;
        case "delivery":
            return process.env.ACTIVITY_DELIVERY
            break;
        default:
            return null;
    }
}

function handleResponseError(err){
    console.error(err);

    if (err.response.status == 401){
        //Token Expired
        console.log("Getting new token")
        getAccessToken()
    }
}

//First request to have the Oauth token saved
getAccessToken()
