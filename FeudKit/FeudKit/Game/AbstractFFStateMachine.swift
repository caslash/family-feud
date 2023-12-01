//
//  AbstractFFStateMachine.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class AbstractFFStateMachine<U: CustomStringConvertible, T: State<U>>: StateMachine<U, T> {
    public override init(name: String) {
        super.init(name: name)
    }
    
    override func getDebugMode() -> Bool {
        //TODO: FamilyFeudTestDriver
        return false
    }
    
    override func printLog(message: String) {
        //TODO: Logger
    }
    
    override func printTransition(message: String) {
        //TODO: Logger
    }
    
    override func printErr(message: String) {
        //TODO: Logger
    }
}
