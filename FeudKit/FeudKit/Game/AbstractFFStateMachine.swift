//
//  AbstractFFStateMachine.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation
import SlashKit

public class AbstractFFStateMachine<U: CustomStringConvertible, T: State<U>>: StateMachine<U, T> {
    public override init(name: String) {
        super.init(name: name)
    }
    
    public override func getDebugMode() -> Bool {
        //TODO: FamilyFeudTestDriver
        return false
    }
    
    public override func printLog(message: String) {
        //TODO: Logger
    }
    
    public override func printTransition(message: String) {
        //TODO: Logger
    }
    
    public override func printErr(message: String) {
        //TODO: Logger
    }
}
