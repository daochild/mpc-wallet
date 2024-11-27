import React, {useEffect} from 'react';
import './App.scss';
import useAuth from "./hooks/useAuth";
import {Header} from "./components/Header";
import {CreateProposal} from "./components/CreateProposal";
import {Proposals} from "./components/Proposals";
import {Alert} from "./UI/Alert";

function App() {

    const {login} = useAuth()

    useEffect(() => {
        login()
    }, [])
  return (
    <div className="App">
        <Alert/>
        <Header/>
        <CreateProposal/>
        <Proposals/>
    </div>
  );
}

export default App;
