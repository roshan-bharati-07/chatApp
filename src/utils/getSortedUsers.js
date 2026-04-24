export const getSortedUsers = (id1, id2) => {
    if(typeof id1 !== "string" ){
        id1 = id1.toString();
    }
    if(typeof id2 !== "string" ){
        id2 = id2.toString();
    }
    
    return id1 < id2
        ? [id1, id2]
        : [id2, id1];
};
